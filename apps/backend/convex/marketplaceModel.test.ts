import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import schema from "./schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.*s");

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const dispatch = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { claimed: number }
>("marketplaceModel:dispatch");
const completeJob = makeFunctionReference<
  "mutation",
  {
    jobId: Id<"marketplaceImageJobs">;
    generatedStorageId: Id<"_storage">;
    durationMs: number;
    mimeType: "image/jpeg";
  },
  boolean
>("marketplaceModel:completeJob");
const failJob = makeFunctionReference<
  "mutation",
  {
    jobId: Id<"marketplaceImageJobs">;
    errorCode: string;
    errorMessage: string;
    durationMs?: number;
  },
  boolean
>("marketplaceModel:failJob");
const expireJob = makeFunctionReference<
  "mutation",
  { jobId: Id<"marketplaceImageJobs">; startedAt: number },
  boolean
>("marketplaceModel:expireJob");

async function insertItemAndJob(
  t: ReturnType<typeof convexTest>,
  status: "pending" | "generating" = "pending",
) {
  return t.run(async (ctx) => {
    const imageStorageId = await ctx.storage.store(
      new Blob(["scene"], { type: "image/jpeg" }),
    );
    const cropStorageId = await ctx.storage.store(
      new Blob(["crop"], { type: "image/webp" }),
    );
    const saleId = await ctx.db.insert("sales", {
      slug: crypto.randomUUID(),
      imageStorageId,
      imageMimeType: "image/jpeg",
      imageWidth: 1000,
      imageHeight: 1000,
      roboflowImageId: crypto.randomUUID(),
      status: "ready",
      processingStage: "complete",
      progress: 100,
      promptVersion: "test",
      providerVersion: "test",
      createdAt: Date.now(),
    });
    const itemId = await ctx.db.insert("items", {
      saleId,
      tempId: crypto.randomUUID(),
      sortOrder: 0,
      selected: true,
      source: "ai",
      title: "Phone",
      category: "Electronics",
      confidence: 0.9,
      roughBox: { x1: 100, y1: 100, x2: 800, y2: 800 },
      maskSource: "bbox",
      maskRevision: 1,
      cropStorageId,
      cropMimeType: "image/webp",
      cropRevision: 1,
      cropStatus: "ready",
      marketplaceImageStatus: status === "generating" ? "generating" : "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const jobId = await ctx.db.insert("marketplaceImageJobs", {
      itemId,
      cropStorageId,
      cropRevision: 1,
      mimeType: "image/webp",
      status,
      createdAt: Date.now(),
      ...(status === "generating" ? { startedAt: Date.now() } : {}),
    });
    await ctx.db.patch("items", itemId, { marketplaceImageJobId: jobId });
    return { itemId, jobId, cropStorageId };
  });
}

describe("marketplace image dispatcher", () => {
  it("claims at most two pending jobs globally", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await insertItemAndJob(t);
    await insertItemAndJob(t);
    await insertItemAndJob(t);

    await expect(t.mutation(dispatch, {})).resolves.toEqual({ claimed: 2 });
    const statuses = await t.run(async (ctx) => ({
      jobs: (await ctx.db.query("marketplaceImageJobs").collect()).map(
        ({ status }) => status,
      ),
      items: (await ctx.db.query("items").collect()).map(
        ({ marketplaceImageStatus }) => marketplaceImageStatus,
      ),
    }));
    expect(statuses.jobs.filter((status) => status === "generating")).toHaveLength(2);
    expect(statuses.jobs.filter((status) => status === "pending")).toHaveLength(1);
    expect(
      statuses.items.filter((status) => status === "generating"),
    ).toHaveLength(2);
    expect(statuses.items.filter((status) => status === "pending")).toHaveLength(1);
  });

  it("claims exactly one pending job when one global slot is occupied", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await insertItemAndJob(t, "generating");
    await insertItemAndJob(t);
    await insertItemAndJob(t);

    await expect(t.mutation(dispatch, {})).resolves.toEqual({ claimed: 1 });
    const statuses = await t.run(async (ctx) =>
      (await ctx.db.query("marketplaceImageJobs").collect()).map(
        ({ status }) => status,
      ),
    );
    expect(statuses.filter((status) => status === "generating")).toHaveLength(2);
    expect(statuses.filter((status) => status === "pending")).toHaveLength(1);
  });

  it("attaches only a result for the current crop revision", async () => {
    const t = convexTest(schema, modules);
    const current = await insertItemAndJob(t, "generating");
    const generatedStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["generated"], { type: "image/jpeg" })),
    );

    await expect(
      t.mutation(completeJob, {
        jobId: current.jobId,
        generatedStorageId,
        durationMs: 1200,
        mimeType: "image/jpeg",
      }),
    ).resolves.toBe(true);
    const attached = await t.run((ctx) => ctx.db.get(current.itemId));
    expect(attached).toMatchObject({
      cropStorageId: current.cropStorageId,
      marketplaceImageStorageId: generatedStorageId,
      marketplaceImageRevision: 1,
      marketplaceImageMimeType: "image/jpeg",
      marketplaceImageMs: 1200,
      marketplaceImageStatus: "ready",
    });

    const stale = await insertItemAndJob(t, "generating");
    await t.run(async (ctx) => {
      const newerCrop = await ctx.storage.store(
        new Blob(["newer"], { type: "image/webp" }),
      );
      await ctx.db.patch("items", stale.itemId, {
        cropStorageId: newerCrop,
        cropRevision: 2,
        marketplaceImageStatus: "pending",
      });
    });
    const staleOutput = await t.run((ctx) =>
      ctx.storage.store(new Blob(["stale"], { type: "image/jpeg" })),
    );
    await expect(
      t.mutation(completeJob, {
        jobId: stale.jobId,
        generatedStorageId: staleOutput,
        durationMs: 900,
        mimeType: "image/jpeg",
      }),
    ).resolves.toBe(false);
    const staleState = await t.run(async (ctx) => ({
      item: await ctx.db.get(stale.itemId),
      job: await ctx.db.get(stale.jobId),
    }));
    expect(staleState.item?.marketplaceImageStorageId).toBeUndefined();
    expect(staleState.job?.status).toBe("stale");
  });

  it("never lets an older attempt overwrite a newer job for the same crop", async () => {
    const t = convexTest(schema, modules);
    const older = await insertItemAndJob(t, "generating");
    const newerJobId = await t.run(async (ctx) => {
      const jobId = await ctx.db.insert("marketplaceImageJobs", {
        itemId: older.itemId,
        cropStorageId: older.cropStorageId,
        cropRevision: 1,
        mimeType: "image/webp",
        status: "generating",
        createdAt: Date.now(),
        startedAt: Date.now(),
      });
      await ctx.db.patch("items", older.itemId, {
        marketplaceImageJobId: jobId,
      });
      return jobId;
    });
    const oldOutput = await t.run((ctx) =>
      ctx.storage.store(new Blob(["old"], { type: "image/jpeg" })),
    );
    const newOutput = await t.run((ctx) =>
      ctx.storage.store(new Blob(["new"], { type: "image/jpeg" })),
    );

    await expect(
      t.mutation(completeJob, {
        jobId: older.jobId,
        generatedStorageId: oldOutput,
        durationMs: 900,
        mimeType: "image/jpeg",
      }),
    ).resolves.toBe(false);
    await expect(
      t.mutation(completeJob, {
        jobId: newerJobId,
        generatedStorageId: newOutput,
        durationMs: 1000,
        mimeType: "image/jpeg",
      }),
    ).resolves.toBe(true);

    const item = await t.run((ctx) => ctx.db.get(older.itemId));
    expect(item).toMatchObject({
      marketplaceImageJobId: newerJobId,
      marketplaceImageStorageId: newOutput,
      marketplaceImageStatus: "ready",
    });
  });

  it("marks only the current item failed and preserves its real crop", async () => {
    const t = convexTest(schema, modules);
    const current = await insertItemAndJob(t, "generating");

    await expect(
      t.mutation(failJob, {
        jobId: current.jobId,
        errorCode: "OPENAI_RATE_LIMITED",
        errorMessage: "OpenAI is temporarily busy.",
        durationMs: 300,
      }),
    ).resolves.toBe(true);
    const state = await t.run(async (ctx) => ({
      item: await ctx.db.get(current.itemId),
      job: await ctx.db.get(current.jobId),
    }));
    expect(state.item).toMatchObject({
      cropStorageId: current.cropStorageId,
      cropStatus: "ready",
      marketplaceImageStatus: "failed",
      marketplaceImageErrorCode: "OPENAI_RATE_LIMITED",
    });
    expect(state.job?.status).toBe("failed");
  });

  it("expires a stuck generation without losing the real crop", async () => {
    const t = convexTest(schema, modules);
    const stuck = await insertItemAndJob(t, "generating");
    const startedAt = Date.now() - 150_000;
    await t.run(async (ctx) => {
      await ctx.db.patch("marketplaceImageJobs", stuck.jobId, { startedAt });
    });

    await expect(
      t.mutation(expireJob, { jobId: stuck.jobId, startedAt }),
    ).resolves.toBe(true);

    const state = await t.run(async (ctx) => ({
      item: await ctx.db.get(stuck.itemId),
      job: await ctx.db.get(stuck.jobId),
    }));
    expect(state.item).toMatchObject({
      cropStorageId: stuck.cropStorageId,
      cropStatus: "ready",
      marketplaceImageStatus: "failed",
      marketplaceImageErrorCode: "MARKETPLACE_GENERATION_TIMEOUT",
    });
    expect(state.job).toMatchObject({
      status: "failed",
      errorCode: "MARKETPLACE_GENERATION_TIMEOUT",
    });
  });
});
