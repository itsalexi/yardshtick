import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  imageMetadataValidator,
  sellerViewValidator,
} from "./lib/validators";

export const createDraft = mutation({
  args: {
    storageId: v.id("_storage"),
    metadata: imageMetadataValidator,
  },
  returns: v.id("sales"),
  handler: async (ctx, { storageId, metadata }) => {
    const now = Date.now();
    const nonce = crypto.randomUUID();
    return ctx.db.insert("sales", {
      slug: `yard-${now.toString(36)}-${nonce.slice(0, 8)}`,
      imageStorageId: storageId,
      imageMimeType: metadata.mimeType,
      imageWidth: metadata.width,
      imageHeight: metadata.height,
      roboflowImageId: `scene_${nonce}`,
      status: "draft",
      processingStage: "uploaded",
      progress: 0,
      promptVersion: "discovery-v1",
      providerVersion: "gpt-5.6-sol+sam2-hiera-tiny",
      createdAt: now,
    });
  },
});

export const getSellerView = query({
  args: { saleId: v.id("sales") },
  returns: v.union(v.null(), sellerViewValidator),
  handler: async (ctx, { saleId }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale) return null;

    const imageUrl = await ctx.storage.getUrl(sale.imageStorageId);
    if (!imageUrl) return null;

    const items = await ctx.db
      .query("items")
      .withIndex("by_saleId", (q) => q.eq("saleId", saleId))
      .collect();
    items.sort((a, b) => a.sortOrder - b.sortOrder);

    const run = sale.activeRunId
      ? await ctx.db
          .query("scanRuns")
          .withIndex("by_saleId_and_runId", (q) =>
            q.eq("saleId", saleId).eq("runId", sale.activeRunId!),
          )
          .unique()
      : await ctx.db
          .query("scanRuns")
          .withIndex("by_saleId", (q) => q.eq("saleId", saleId))
          .order("desc")
          .first();

    const mappedItems = await Promise.all(
      items.map(async (item) => {
        const mask =
          item.maskRevision > 0
            ? await ctx.db
                .query("itemMasks")
                .withIndex("by_itemId_and_revision", (q) =>
                  q.eq("itemId", item._id).eq("revision", item.maskRevision),
                )
                .unique()
            : null;
        const polygons = (mask?.polygons ?? []).map((polygon) =>
          polygon.map((point) => [point[0]!, point[1]!] as [number, number]),
        );

        return {
          id: item._id,
          tempId: item.tempId,
          sortOrder: item.sortOrder,
          selected: item.selected,
          title: item.title,
          category: item.category,
          confidence: item.confidence,
          roughBox: item.roughBox,
          refinedBox: item.refinedBox ?? null,
          maskSource: item.maskSource,
          maskRevision: item.maskRevision,
          polygons,
          segmentationConfidence: item.segmentationConfidence ?? null,
        };
      }),
    );

    return {
      id: sale._id,
      slug: sale.slug,
      status: sale.status,
      processingStage: sale.processingStage,
      progress: sale.progress,
      activeRunId: sale.activeRunId ?? null,
      image: {
        url: imageUrl,
        width: sale.imageWidth,
        height: sale.imageHeight,
        mimeType: sale.imageMimeType,
      },
      error:
        sale.errorCode && sale.errorMessage
          ? { code: sale.errorCode, message: sale.errorMessage }
          : null,
      run: run
        ? {
            status: run.status,
            stage: run.stage,
            candidateCount: run.candidateCount,
            polygonCount: run.polygonCount,
            fallbackCount: run.fallbackCount,
            ...(run.discoveryMs === undefined ? {} : { discoveryMs: run.discoveryMs }),
            ...(run.embeddingMs === undefined ? {} : { embeddingMs: run.embeddingMs }),
            ...(run.segmentationMs === undefined
              ? {}
              : { segmentationMs: run.segmentationMs }),
            ...(run.totalMs === undefined ? {} : { totalMs: run.totalMs }),
          }
        : null,
      items: mappedItems,
    };
  },
});
