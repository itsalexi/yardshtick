import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import type { ScanSellerView } from "@yard/contracts";
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

const attachCrop = makeFunctionReference<
  "mutation",
  {
    itemId: Id<"items">;
    storageId: Id<"_storage">;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    maskRevision: number;
  },
  { jobId: Id<"marketplaceImageJobs">; cropRevision: number }
>("items:attachCrop");
const getSellerView = makeFunctionReference<
  "query",
  { saleId: Id<"sales"> },
  ScanSellerView | null
>("sales:getSellerView");
const retryMarketplaceImage = makeFunctionReference<
  "mutation",
  { itemId: Id<"items"> },
  { jobId: Id<"marketplaceImageJobs"> }
>("items:retryMarketplaceImage");

async function readyItemFixture() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const imageStorageId = await ctx.storage.store(
      new Blob(["scene"], { type: "image/jpeg" }),
    );
    const saleId = await ctx.db.insert("sales", {
      slug: "fixture",
      imageStorageId,
      imageMimeType: "image/jpeg",
      imageWidth: 1000,
      imageHeight: 1000,
      roboflowImageId: "fixture",
      status: "ready",
      processingStage: "complete",
      progress: 100,
      promptVersion: "test",
      providerVersion: "test",
      createdAt: Date.now(),
    });
    const itemId = await ctx.db.insert("items", {
      saleId,
      tempId: "item-1",
      sortOrder: 0,
      selected: true,
      source: "ai",
      title: "Phone",
      category: "Electronics",
      confidence: 0.9,
      roughBox: { x1: 100, y1: 100, x2: 800, y2: 800 },
      refinedBox: { x1: 110, y1: 110, x2: 790, y2: 790 },
      maskSource: "roboflow_sam2",
      segmentationConfidence: 0.91,
      maskRevision: 2,
      cropStatus: "missing",
      marketplaceImageStatus: "idle",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const cropStorageId = await ctx.storage.store(
      new Blob(["crop"], { type: "image/webp" }),
    );
    return { saleId, itemId, cropStorageId };
  });
  return { t, ...fixture };
}

describe("items.attachCrop", () => {
  it("rejects a crop made from a stale mask revision", async () => {
    const { t, itemId, cropStorageId } = await readyItemFixture();

    await expect(
      t.mutation(attachCrop, {
        itemId,
        storageId: cropStorageId,
        mimeType: "image/webp",
        maskRevision: 1,
      }),
    ).rejects.toThrow(/current mask revision/i);

    const item = await t.run((ctx) => ctx.db.get(itemId));
    expect(item).toMatchObject({ cropStatus: "missing", maskRevision: 2 });
  });

  it("attaches a current crop and creates one immutable pending job", async () => {
    vi.useFakeTimers();
    const { t, saleId, itemId, cropStorageId } = await readyItemFixture();

    const result = await t.mutation(attachCrop, {
      itemId,
      storageId: cropStorageId,
      mimeType: "image/webp",
      maskRevision: 2,
    });

    expect(result.cropRevision).toBe(2);
    const state = await t.run(async (ctx) => ({
      item: await ctx.db.get(itemId),
      job: await ctx.db.get(result.jobId),
    }));
    expect(state.item).toMatchObject({
      cropStorageId,
      cropMimeType: "image/webp",
      cropRevision: 2,
      cropStatus: "ready",
      marketplaceImageStatus: "pending",
    });
    expect(state.job).toMatchObject({
      itemId,
      cropStorageId,
      cropRevision: 2,
      mimeType: "image/webp",
      status: "pending",
    });
    const sellerView = await t.query(getSellerView, { saleId });
    expect(sellerView?.items[0]?.crop).toMatchObject({
      status: "ready",
      revision: 2,
    });
    expect(sellerView?.items[0]?.marketplaceImage.status).toBe("pending");
    expect(sellerView?.items[0]?.marketplaceImage.revision).toBe(2);
  });

  it("does not retry a crop from an obsolete mask revision", async () => {
    const { t, itemId, cropStorageId } = await readyItemFixture();
    await t.run(async (ctx) => {
      await ctx.db.patch("items", itemId, {
        cropStorageId,
        cropMimeType: "image/webp",
        cropRevision: 1,
        cropStatus: "ready",
        marketplaceImageStatus: "failed",
      });
    });

    await expect(
      t.mutation(retryMarketplaceImage, { itemId }),
    ).rejects.toThrow(/current real crop/i);
  });
});
