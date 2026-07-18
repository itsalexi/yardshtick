import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import {
  imageMimeTypeValidator,
  listingConditionValidator,
} from "./lib/validators";

export const setSelected = mutation({
  args: {
    itemId: v.id("items"),
    selected: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, selected }) => {
    const item = await ctx.db.get("items", itemId);
    if (!item) throw new Error("Item not found.");
    const sale = await ctx.db.get("sales", item.saleId);
    if (!sale) throw new Error("Sale not found.");
    if (sale.status === "published") {
      throw new Error("Published sale listings cannot be changed.");
    }

    await ctx.db.patch("items", itemId, {
      selected,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const updateListing = mutation({
  args: {
    itemId: v.id("items"),
    title: v.optional(v.string()),
    condition: v.optional(listingConditionValidator),
    finalPricePhp: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, title, condition, finalPricePhp }) => {
    if (
      title === undefined &&
      condition === undefined &&
      finalPricePhp === undefined
    ) {
      throw new Error("Provide at least one listing change.");
    }

    const item = await ctx.db.get("items", itemId);
    if (!item) throw new Error("Item not found.");
    const sale = await ctx.db.get("sales", item.saleId);
    if (!sale) throw new Error("Sale not found.");
    if (sale.status === "published") {
      throw new Error("Published sale listings cannot be changed.");
    }

    const normalizedTitle = title?.trim();
    if (normalizedTitle !== undefined && normalizedTitle.length === 0) {
      throw new Error("Listing title cannot be blank.");
    }
    if (
      finalPricePhp !== undefined &&
      (!Number.isFinite(finalPricePhp) || finalPricePhp <= 0)
    ) {
      throw new Error("Listing price must be a positive number.");
    }

    await ctx.db.patch("items", itemId, {
      ...(normalizedTitle === undefined ? {} : { title: normalizedTitle }),
      ...(condition === undefined ? {} : { condition }),
      ...(finalPricePhp === undefined ? {} : { finalPricePhp }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const reserve = mutation({
  args: {
    slug: v.string(),
    itemId: v.id("items"),
    buyerName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { slug, itemId, buyerName }) => {
    const normalizedBuyerName = buyerName.trim();
    if (normalizedBuyerName.length === 0 || normalizedBuyerName.length > 60) {
      throw new Error("Buyer name must be between 1 and 60 characters.");
    }

    const sale = await ctx.db
      .query("sales")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!sale) throw new Error("Sale not found.");
    if (sale.status !== "published") {
      throw new Error("Only published sales can accept reservations.");
    }

    const item = await ctx.db.get("items", itemId);
    if (!item) throw new Error("Item not found.");
    if (item.saleId !== sale._id) {
      throw new Error("Item does not belong to this sale.");
    }
    if (!item.selected || (item.status ?? "available") !== "available") {
      throw new Error("Item is not available for reservation.");
    }

    await ctx.db.patch("items", itemId, {
      status: "reserved",
      reservedByName: normalizedBuyerName,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const attachCrop = mutation({
  args: {
    itemId: v.id("items"),
    storageId: v.id("_storage"),
    mimeType: imageMimeTypeValidator,
    maskRevision: v.number(),
  },
  returns: v.object({
    jobId: v.id("marketplaceImageJobs"),
    cropRevision: v.number(),
  }),
  handler: async (ctx, { itemId, storageId, mimeType, maskRevision }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Item not found.");
    if (maskRevision <= 0 || item.maskRevision !== maskRevision) {
      throw new Error("The crop does not match the current mask revision.");
    }

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata) throw new Error("The uploaded crop could not be found.");
    if (metadata.contentType !== undefined && metadata.contentType !== mimeType) {
      throw new Error("The uploaded crop MIME type does not match its metadata.");
    }

    const jobs = await ctx.db
      .query("marketplaceImageJobs")
      .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
      .collect();
    const now = Date.now();
    for (const job of jobs) {
      if (job.status === "pending") {
        await ctx.db.patch("marketplaceImageJobs", job._id, {
          status: "stale",
          completedAt: now,
        });
      }
    }

    if (item.cropStorageId && item.cropStorageId !== storageId) {
      await ctx.storage.delete(item.cropStorageId);
    }
    if (item.marketplaceImageStorageId) {
      await ctx.storage.delete(item.marketplaceImageStorageId);
    }

    const jobId = await ctx.db.insert("marketplaceImageJobs", {
      itemId,
      cropStorageId: storageId,
      cropRevision: maskRevision,
      mimeType,
      status: "pending",
      createdAt: now,
    });
    await ctx.db.patch("items", itemId, {
      cropStorageId: storageId,
      cropMimeType: mimeType,
      cropRevision: maskRevision,
      cropStatus: "ready",
      marketplaceImageStorageId: undefined,
      marketplaceImageJobId: jobId,
      marketplaceImageRevision: undefined,
      marketplaceImageMimeType: undefined,
      marketplaceImageMs: undefined,
      marketplaceImageErrorCode: undefined,
      marketplaceImageErrorMessage: undefined,
      marketplaceImageStatus: "pending",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.marketplaceModel.dispatch, {});

    return { jobId, cropRevision: maskRevision };
  },
});

export const retryMarketplaceImage = mutation({
  args: { itemId: v.id("items") },
  returns: v.object({ jobId: v.id("marketplaceImageJobs") }),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (
      !item ||
      item.cropStatus !== "ready" ||
      !item.cropStorageId ||
      !item.cropMimeType ||
      item.cropRevision === undefined ||
      item.cropRevision !== item.maskRevision
    ) {
      throw new Error("A current real crop is required before retrying.");
    }
    if (item.marketplaceImageStatus !== "failed") {
      throw new Error("Only a failed marketplace image can be retried.");
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("marketplaceImageJobs", {
      itemId,
      cropStorageId: item.cropStorageId,
      cropRevision: item.cropRevision,
      mimeType: item.cropMimeType,
      status: "pending",
      createdAt: now,
    });
    await ctx.db.patch("items", itemId, {
      marketplaceImageStorageId: undefined,
      marketplaceImageJobId: jobId,
      marketplaceImageRevision: undefined,
      marketplaceImageMimeType: undefined,
      marketplaceImageMs: undefined,
      marketplaceImageStatus: "pending",
      marketplaceImageErrorCode: undefined,
      marketplaceImageErrorMessage: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.marketplaceModel.dispatch, {});
    return { jobId };
  },
});
