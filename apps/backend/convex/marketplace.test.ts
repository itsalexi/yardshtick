import { generateMarketplaceImage } from "@yard/ai";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import schema from "./schema";

vi.mock("@yard/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@yard/ai")>();
  return { ...original, generateMarketplaceImage: vi.fn() };
});

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.*s");
const generate = makeFunctionReference<
  "action",
  { jobId: Id<"marketplaceImageJobs"> },
  null
>("marketplace:generate");
const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.clearAllMocks();
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

async function insertGeneratingJob(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const sceneStorageId = await ctx.storage.store(
      new Blob([Uint8Array.from([4, 5, 6]).buffer], { type: "image/jpeg" }),
    );
    const cropStorageId = await ctx.storage.store(
      new Blob([Uint8Array.from([1, 2, 3]).buffer], { type: "image/webp" }),
    );
    const saleId = await ctx.db.insert("sales", {
      slug: crypto.randomUUID(),
      imageStorageId: sceneStorageId,
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
      title: "Rolling whiteboard",
      category: "Office furniture",
      confidence: 0.9,
      roughBox: { x1: 100, y1: 100, x2: 800, y2: 800 },
      maskSource: "bbox",
      maskRevision: 1,
      cropStorageId,
      cropMimeType: "image/webp",
      cropRevision: 1,
      cropStatus: "ready",
      marketplaceImageStatus: "generating",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const jobId = await ctx.db.insert("marketplaceImageJobs", {
      itemId,
      cropStorageId,
      cropRevision: 1,
      mimeType: "image/webp",
      status: "generating",
      createdAt: Date.now(),
      startedAt: Date.now(),
    });
    await ctx.db.patch("items", itemId, { marketplaceImageJobId: jobId });
    return { cropStorageId, itemId, jobId, sceneStorageId };
  });
}

describe("marketplace image action", () => {
  it("passes the crop first and the original scene second", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const t = convexTest(schema, modules);
    const current = await insertGeneratingJob(t);
    const generateMock = vi.mocked(generateMarketplaceImage);
    generateMock.mockResolvedValue(
      Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]),
    );

    await expect(t.action(generate, { jobId: current.jobId })).resolves.toBeNull();

    expect(generateMock).toHaveBeenCalledOnce();
    const input = generateMock.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      apiKey: "test-key",
      mimeType: "image/webp",
      contextMimeType: "image/jpeg",
    });
    expect(Array.from(input?.image ?? [])).toEqual([1, 2, 3]);
    expect(Array.from(input?.contextImage ?? [])).toEqual([4, 5, 6]);
    expect(input?.signal).toBeInstanceOf(AbortSignal);

    const item = await t.run((ctx) => ctx.db.get(current.itemId));
    expect(item).toMatchObject({
      cropStorageId: current.cropStorageId,
      cropStatus: "ready",
      marketplaceImageStatus: "ready",
      marketplaceImageMimeType: "image/jpeg",
    });
  });

  it("fails safely when the original scene is missing", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const t = convexTest(schema, modules);
    const current = await insertGeneratingJob(t);
    await t.run((ctx) => ctx.storage.delete(current.sceneStorageId));

    await expect(t.action(generate, { jobId: current.jobId })).resolves.toBeNull();

    expect(generateMarketplaceImage).not.toHaveBeenCalled();
    const state = await t.run(async (ctx) => ({
      cropExists: (await ctx.storage.get(current.cropStorageId)) !== null,
      item: await ctx.db.get(current.itemId),
      job: await ctx.db.get(current.jobId),
    }));
    expect(state.cropExists).toBe(true);
    expect(state.item).toMatchObject({
      cropStorageId: current.cropStorageId,
      cropStatus: "ready",
      marketplaceImageStatus: "failed",
      marketplaceImageErrorCode: "SCENE_NOT_FOUND",
    });
    expect(state.job).toMatchObject({
      status: "failed",
      errorCode: "SCENE_NOT_FOUND",
    });
  });
});
