import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { imageMimeTypeValidator } from "./lib/validators";

const MAX_GENERATING_JOBS = 2;
const MARKETPLACE_JOB_LEASE_MS = 180_000;

export const dispatch = internalMutation({
  args: {},
  returns: v.object({ claimed: v.number() }),
  handler: async (ctx) => {
    const generating = await ctx.db
      .query("marketplaceImageJobs")
      .withIndex("by_status_and_createdAt", (q) =>
        q.eq("status", "generating"),
      )
      .take(MAX_GENERATING_JOBS);
    const availableSlots = Math.max(
      0,
      MAX_GENERATING_JOBS - generating.length,
    );
    if (availableSlots === 0) return { claimed: 0 };

    const pending = await ctx.db
      .query("marketplaceImageJobs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(availableSlots);
    const startedAt = Date.now();
    let claimed = 0;
    for (const job of pending) {
      const item = await ctx.db.get(job.itemId);
      const isCurrent =
        item !== null &&
        item.marketplaceImageJobId === job._id &&
        item.cropStorageId === job.cropStorageId &&
        item.cropRevision === job.cropRevision &&
        item.maskRevision === job.cropRevision;
      if (!isCurrent) {
        await ctx.db.patch("marketplaceImageJobs", job._id, {
          status: "stale",
          completedAt: startedAt,
        });
        continue;
      }
      await ctx.db.patch("marketplaceImageJobs", job._id, {
        status: "generating",
        startedAt,
      });
      await ctx.db.patch("items", item._id, {
        marketplaceImageStatus: "generating",
        updatedAt: startedAt,
      });
      await ctx.scheduler.runAfter(0, internal.marketplace.generate, {
        jobId: job._id,
      });
      await ctx.scheduler.runAfter(
        MARKETPLACE_JOB_LEASE_MS,
        internal.marketplaceModel.expireJob,
        { jobId: job._id, startedAt },
      );
      claimed += 1;
    }
    return { claimed };
  },
});

export const expireJob = internalMutation({
  args: {
    jobId: v.id("marketplaceImageJobs"),
    startedAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, { jobId, startedAt }) => {
    const job = await ctx.db.get(jobId);
    if (
      !job ||
      job.status !== "generating" ||
      job.startedAt !== startedAt
    ) {
      return false;
    }

    const item = await ctx.db.get(job.itemId);
    const completedAt = Date.now();
    const durationMs = Math.max(0, completedAt - startedAt);
    const isCurrent =
      item !== null &&
      item.marketplaceImageJobId === job._id &&
      item.cropStorageId === job.cropStorageId &&
      item.cropRevision === job.cropRevision &&
      item.maskRevision === job.cropRevision;
    const errorCode = "MARKETPLACE_GENERATION_TIMEOUT";
    const errorMessage = "Marketplace image generation timed out. Please retry.";

    if (isCurrent) {
      await ctx.db.patch("items", item._id, {
        marketplaceImageStatus: "failed",
        marketplaceImageErrorCode: errorCode,
        marketplaceImageErrorMessage: errorMessage,
        marketplaceImageMs: durationMs,
        updatedAt: completedAt,
      });
    }
    await ctx.db.patch("marketplaceImageJobs", jobId, {
      status: isCurrent ? "failed" : "stale",
      durationMs,
      errorCode,
      errorMessage,
      completedAt,
    });
    await ctx.scheduler.runAfter(0, internal.marketplaceModel.dispatch, {});
    return true;
  },
});

export const loadJobInput = internalQuery({
  args: { jobId: v.id("marketplaceImageJobs") },
  returns: v.union(
    v.null(),
    v.object({
      itemId: v.id("items"),
      cropStorageId: v.id("_storage"),
      cropRevision: v.number(),
      mimeType: imageMimeTypeValidator,
      sceneStorageId: v.id("_storage"),
      sceneMimeType: imageMimeTypeValidator,
      title: v.string(),
      category: v.string(),
    }),
  ),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "generating") return null;
    const item = await ctx.db.get(job.itemId);
    if (
      !item ||
      item.marketplaceImageJobId !== job._id ||
      item.cropStorageId !== job.cropStorageId ||
      item.cropRevision !== job.cropRevision ||
      item.maskRevision !== job.cropRevision
    ) {
      return null;
    }
    const sale = await ctx.db.get(item.saleId);
    if (!sale) return null;
    return {
      itemId: item._id,
      cropStorageId: job.cropStorageId,
      cropRevision: job.cropRevision,
      mimeType: job.mimeType,
      sceneStorageId: sale.imageStorageId,
      sceneMimeType: sale.imageMimeType,
      title: item.title,
      category: item.category,
    };
  },
});

export const completeJob = internalMutation({
  args: {
    jobId: v.id("marketplaceImageJobs"),
    generatedStorageId: v.id("_storage"),
    durationMs: v.number(),
    mimeType: v.literal("image/jpeg"),
  },
  returns: v.boolean(),
  handler: async (
    ctx,
    { jobId, generatedStorageId, durationMs, mimeType },
  ) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "generating") return false;
    const item = await ctx.db.get(job.itemId);
    const completedAt = Date.now();
    const isCurrent =
      item !== null &&
      item.marketplaceImageJobId === job._id &&
      item.cropStorageId === job.cropStorageId &&
      item.cropRevision === job.cropRevision &&
      item.maskRevision === job.cropRevision;

    if (!isCurrent) {
      await ctx.db.patch("marketplaceImageJobs", jobId, {
        status: "stale",
        completedAt,
      });
      await ctx.scheduler.runAfter(0, internal.marketplaceModel.dispatch, {});
      return false;
    }

    await ctx.db.patch("items", item._id, {
      marketplaceImageStorageId: generatedStorageId,
      marketplaceImageRevision: job.cropRevision,
      marketplaceImageMimeType: mimeType,
      marketplaceImageMs: durationMs,
      marketplaceImageErrorCode: undefined,
      marketplaceImageErrorMessage: undefined,
      marketplaceImageStatus: "ready",
      updatedAt: completedAt,
    });
    await ctx.db.patch("marketplaceImageJobs", jobId, {
      status: "complete",
      generatedStorageId,
      durationMs,
      completedAt,
    });
    await ctx.scheduler.runAfter(0, internal.marketplaceModel.dispatch, {});
    return true;
  },
});

export const failJob = internalMutation({
  args: {
    jobId: v.id("marketplaceImageJobs"),
    errorCode: v.string(),
    errorMessage: v.string(),
    durationMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (
    ctx,
    { jobId, errorCode, errorMessage, durationMs },
  ) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "generating") return false;
    const item = await ctx.db.get(job.itemId);
    const completedAt = Date.now();
    const isCurrent =
      item !== null &&
      item.marketplaceImageJobId === job._id &&
      item.cropStorageId === job.cropStorageId &&
      item.cropRevision === job.cropRevision &&
      item.maskRevision === job.cropRevision;

    if (isCurrent) {
      await ctx.db.patch("items", item._id, {
        marketplaceImageStatus: "failed",
        marketplaceImageErrorCode: errorCode,
        marketplaceImageErrorMessage: errorMessage,
        marketplaceImageMs: durationMs,
        updatedAt: completedAt,
      });
    }
    await ctx.db.patch("marketplaceImageJobs", jobId, {
      status: isCurrent ? "failed" : "stale",
      errorCode,
      errorMessage,
      completedAt,
      ...(durationMs === undefined ? {} : { durationMs }),
    });
    await ctx.scheduler.runAfter(0, internal.marketplaceModel.dispatch, {});
    return isCurrent;
  },
});
