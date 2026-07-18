import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  imageMetadataValidator,
  sellerViewValidator,
  storefrontValidator,
} from "./lib/validators";
import {
  DISCOVERY_PROMPT_VERSION,
  DISCOVERY_PROVIDER_VERSION,
} from "./lib/versions";

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
      title: "Yard Sale",
      imageStorageId: storageId,
      imageMimeType: metadata.mimeType,
      imageWidth: metadata.width,
      imageHeight: metadata.height,
      roboflowImageId: `scene_${nonce}`,
      status: "draft",
      processingStage: "uploaded",
      progress: 0,
      promptVersion: DISCOVERY_PROMPT_VERSION,
      providerVersion: DISCOVERY_PROVIDER_VERSION,
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
        const cropIsCurrent =
          item.cropStorageId !== undefined &&
          item.cropRevision === item.maskRevision;
        const cropUrl = cropIsCurrent
          ? await ctx.storage.getUrl(item.cropStorageId!)
          : null;
        const marketplaceImageIsCurrent =
          cropIsCurrent &&
          item.marketplaceImageStorageId !== undefined &&
          item.marketplaceImageRevision === item.cropRevision;
        const marketplaceImageUrl = marketplaceImageIsCurrent
          ? await ctx.storage.getUrl(item.marketplaceImageStorageId!)
          : null;

        return {
          id: item._id,
          tempId: item.tempId,
          sortOrder: item.sortOrder,
          selected: item.selected,
          title: item.title,
          category: item.category,
          condition: item.condition ?? "good",
          ...(item.finalPricePhp === undefined
            ? {}
            : { finalPricePhp: item.finalPricePhp }),
          status: item.status ?? "available",
          ...(item.reservedByName === undefined
            ? {}
            : { reservedByName: item.reservedByName }),
          confidence: item.confidence,
          roughBox: item.roughBox,
          refinedBox: item.refinedBox ?? null,
          maskSource: item.maskSource,
          maskRevision: item.maskRevision,
          polygons,
          segmentationConfidence: item.segmentationConfidence ?? null,
          crop: {
            status: cropIsCurrent ? item.cropStatus : "missing",
            revision: cropIsCurrent ? (item.cropRevision ?? null) : null,
            url: cropUrl,
            mimeType: cropIsCurrent ? (item.cropMimeType ?? null) : null,
          },
          marketplaceImage: {
            status: cropIsCurrent ? item.marketplaceImageStatus : "idle",
            revision:
              cropIsCurrent && item.marketplaceImageStatus !== "idle"
                ? (item.cropRevision ?? null)
                : null,
            url: marketplaceImageUrl,
            mimeType: marketplaceImageIsCurrent
              ? (item.marketplaceImageMimeType ?? null)
              : null,
            durationMs: cropIsCurrent ? (item.marketplaceImageMs ?? null) : null,
            error:
              cropIsCurrent &&
              item.marketplaceImageErrorCode &&
              item.marketplaceImageErrorMessage
                ? {
                    code: item.marketplaceImageErrorCode,
                    message: item.marketplaceImageErrorMessage,
                  }
                : null,
          },
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

export const getLatest = query({
  args: {},
  returns: v.union(v.id("sales"), v.null()),
  handler: async (ctx) => {
    const sale = await ctx.db
      .query("sales")
      .withIndex("by_createdAt")
      .order("desc")
      .first();
    return sale?._id ?? null;
  },
});

export const publish = mutation({
  args: { saleId: v.id("sales") },
  returns: v.string(),
  handler: async (ctx, { saleId }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale) throw new Error("Sale not found.");
    if (sale.status !== "ready" && sale.status !== "published") {
      throw new Error("Only a ready sale can be published.");
    }
    if (sale.processingStage !== "complete") {
      throw new Error("The current scan must finish before publishing.");
    }

    const selectedItems = await ctx.db
      .query("items")
      .withIndex("by_saleId_and_selected", (q) =>
        q.eq("saleId", saleId).eq("selected", true),
      )
      .collect();
    if (selectedItems.length === 0) {
      throw new Error("Select at least one item before publishing.");
    }

    for (const item of selectedItems) {
      if (item.title.trim().length === 0) {
        throw new Error("Every selected item needs a title before publishing.");
      }
      if (
        item.finalPricePhp === undefined ||
        !Number.isFinite(item.finalPricePhp) ||
        item.finalPricePhp <= 0
      ) {
        throw new Error("Every selected item needs a positive price before publishing.");
      }
      const cropIsCurrent =
        item.maskRevision > 0 &&
        item.maskSource !== "pending" &&
        item.cropStatus === "ready" &&
        item.cropStorageId !== undefined &&
        item.cropRevision === item.maskRevision;
      if (!cropIsCurrent) {
        throw new Error("Every selected item needs a current crop before publishing.");
      }
    }

    await ctx.db.patch("sales", saleId, {
      status: "published",
      title: sale.title?.trim() || "Yard Sale",
    });
    return sale.slug;
  },
});

export const getStorefront = query({
  args: { slug: v.string() },
  returns: v.union(v.null(), storefrontValidator),
  handler: async (ctx, { slug }) => {
    const sale = await ctx.db
      .query("sales")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!sale || sale.status !== "published") return null;

    const selectedItems = await ctx.db
      .query("items")
      .withIndex("by_saleId_and_selected", (q) =>
        q.eq("saleId", sale._id).eq("selected", true),
      )
      .collect();
    selectedItems.sort((left, right) => left.sortOrder - right.sortOrder);

    const items = await Promise.all(
      selectedItems.map(async (item) => {
        if (
          item.maskRevision <= 0 ||
          item.maskSource === "pending" ||
          item.finalPricePhp === undefined ||
          item.finalPricePhp <= 0
        ) {
          throw new Error("Published listing data is incomplete.");
        }
        const cropIsCurrent =
          item.cropStatus === "ready" &&
          item.cropStorageId !== undefined &&
          item.cropRevision === item.maskRevision;
        if (!cropIsCurrent) {
          throw new Error("Published listing crop is no longer current.");
        }
        const marketplaceImageIsCurrent =
          item.marketplaceImageStatus === "ready" &&
          item.marketplaceImageStorageId !== undefined &&
          item.marketplaceImageRevision === item.cropRevision;
        const marketplaceImageUrl = marketplaceImageIsCurrent
          ? await ctx.storage.getUrl(item.marketplaceImageStorageId!)
          : null;
        const imageUrl =
          marketplaceImageUrl ??
          (await ctx.storage.getUrl(item.cropStorageId!));
        if (!imageUrl) throw new Error("Published listing image is unavailable.");

        const mask = await ctx.db
          .query("itemMasks")
          .withIndex("by_itemId_and_revision", (q) =>
            q.eq("itemId", item._id).eq("revision", item.maskRevision),
          )
          .unique();
        return {
          id: item._id,
          selected: true,
          title: item.title,
          category: item.category,
          condition: item.condition ?? "good",
          finalPricePhp: item.finalPricePhp,
          status: item.status ?? "available",
          ...(item.reservedByName === undefined
            ? {}
            : { reservedByName: item.reservedByName }),
          roughBox: item.roughBox,
          maskSource: item.maskSource,
          polygons: (mask?.polygons ?? []).map((polygon) =>
            polygon.map((point) => [point[0]!, point[1]!] as [number, number]),
          ),
          imageUrl,
        };
      }),
    );

    return {
      slug: sale.slug,
      title: sale.title?.trim() || "Yard Sale",
      items,
    };
  },
});
