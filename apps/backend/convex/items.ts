import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { imageMimeTypeValidator } from "./lib/validators";

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
