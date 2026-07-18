import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import {
  candidateValidator,
  imageMimeTypeValidator,
  segmentationResultValidator,
} from "./lib/validators";

export const beginRun = internalMutation({
  args: { saleId: v.id("sales") },
  returns: v.object({ runId: v.string() }),
  handler: async (ctx, { saleId }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale) throw new Error("Sale not found");
    const now = Date.now();

    if (sale.activeRunId) {
      const previous = await ctx.db
        .query("scanRuns")
        .withIndex("by_saleId_and_runId", (q) =>
          q.eq("saleId", saleId).eq("runId", sale.activeRunId!),
        )
        .unique();
      if (previous?.status === "running") {
        await ctx.db.patch("scanRuns", previous._id, {
          status: "failed",
          stage: "failed",
          errorCode: "RUN_SUPERSEDED",
          errorMessage: "A newer scan replaced this run.",
          completedAt: now,
        });
      }
    }

    const runId = crypto.randomUUID();
    await ctx.db.insert("scanRuns", {
      saleId,
      runId,
      status: "running",
      stage: "discovering",
      candidateCount: 0,
      polygonCount: 0,
      fallbackCount: 0,
      createdAt: now,
    });
    await ctx.db.patch("sales", saleId, {
      status: "processing",
      processingStage: "discovering",
      progress: 10,
      activeRunId: runId,
      errorCode: undefined,
      errorMessage: undefined,
      completedAt: undefined,
    });
    return { runId };
  },
});

export const loadScanInput = internalQuery({
  args: { saleId: v.id("sales"), runId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      storageId: v.id("_storage"),
      imageId: v.string(),
      width: v.number(),
      height: v.number(),
      mimeType: imageMimeTypeValidator,
    }),
  ),
  handler: async (ctx, { saleId, runId }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale || sale.activeRunId !== runId) return null;
    return {
      storageId: sale.imageStorageId,
      imageId: sale.roboflowImageId,
      width: sale.imageWidth,
      height: sale.imageHeight,
      mimeType: sale.imageMimeType,
    };
  },
});

export const persistCandidates = internalMutation({
  args: {
    saleId: v.id("sales"),
    runId: v.string(),
    candidates: v.array(candidateValidator),
    discoveryMs: v.number(),
    openaiResponseId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, { saleId, runId, candidates, discoveryMs, openaiResponseId }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale || sale.activeRunId !== runId) return false;

    const previousItems = await ctx.db
      .query("items")
      .withIndex("by_saleId", (q) => q.eq("saleId", saleId))
      .collect();
    for (const item of previousItems) {
      const masks = await ctx.db
        .query("itemMasks")
        .withIndex("by_itemId", (q) => q.eq("itemId", item._id))
        .collect();
      for (const mask of masks) await ctx.db.delete("itemMasks", mask._id);
      await ctx.db.delete("items", item._id);
    }

    const now = Date.now();
    for (const [sortOrder, candidate] of candidates.entries()) {
      await ctx.db.insert("items", {
        saleId,
        tempId: candidate.tempId,
        sortOrder,
        selected: true,
        source: "ai",
        title: candidate.displayName,
        category: candidate.category,
        confidence: candidate.sellabilityConfidence,
        roughBox: candidate.roughBox,
        maskSource: "pending",
        maskRevision: 0,
        cropStatus: "missing",
        marketplaceImageStatus: "idle",
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch("sales", saleId, {
      processingStage: "segmenting",
      progress: 55,
    });
    const run = await ctx.db
      .query("scanRuns")
      .withIndex("by_saleId_and_runId", (q) => q.eq("saleId", saleId).eq("runId", runId))
      .unique();
    if (run) {
      await ctx.db.patch("scanRuns", run._id, {
        stage: "segmenting",
        candidateCount: candidates.length,
        discoveryMs,
        ...(openaiResponseId === undefined ? {} : { openaiResponseId }),
      });
    }
    return true;
  },
});

export const persistSegmentation = internalMutation({
  args: {
    saleId: v.id("sales"),
    runId: v.string(),
    results: v.array(segmentationResultValidator),
    segmentationMs: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, { saleId, runId, results, segmentationMs }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale || sale.activeRunId !== runId) return false;

    const items = await ctx.db
      .query("items")
      .withIndex("by_saleId", (q) => q.eq("saleId", saleId))
      .collect();
    const byTempId = new Map(results.map((result) => [result.tempId, result]));
    let polygonCount = 0;
    let fallbackCount = 0;
    const now = Date.now();

    for (const item of items) {
      const result = byTempId.get(item.tempId) ?? {
        tempId: item.tempId,
        maskSource: "bbox" as const,
        polygons: [],
        refinedBox: item.roughBox,
      };
      const revision = item.maskRevision + 1;
      polygonCount += result.polygons.length;
      if (result.maskSource === "bbox") fallbackCount += 1;

      await ctx.db.insert("itemMasks", {
        itemId: item._id,
        revision,
        polygons: result.polygons,
        promptBox: item.roughBox,
        promptPoints: [],
        provider: result.maskSource === "bbox" ? "fallback" : "roboflow",
        model: result.maskSource === "bbox" ? "bbox" : "sam2-hiera-tiny",
        ...(result.confidence === undefined ? {} : { confidence: result.confidence }),
        createdAt: now,
      });
      await ctx.db.patch("items", item._id, {
        refinedBox: result.refinedBox,
        maskSource: result.maskSource,
        maskRevision: revision,
        segmentationConfidence: result.confidence,
        updatedAt: now,
      });
    }

    await ctx.db.patch("sales", saleId, { progress: 90 });
    const run = await ctx.db
      .query("scanRuns")
      .withIndex("by_saleId_and_runId", (q) => q.eq("saleId", saleId).eq("runId", runId))
      .unique();
    if (run) {
      await ctx.db.patch("scanRuns", run._id, {
        polygonCount,
        fallbackCount,
        segmentationMs,
      });
    }
    return true;
  },
});

export const completeRun = internalMutation({
  args: {
    saleId: v.id("sales"),
    runId: v.string(),
    embeddingMs: v.optional(v.number()),
    totalMs: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, { saleId, runId, embeddingMs, totalMs }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale || sale.activeRunId !== runId) return false;
    const completedAt = Date.now();
    await ctx.db.patch("sales", saleId, {
      status: "ready",
      processingStage: "complete",
      progress: 100,
      completedAt,
    });
    const run = await ctx.db
      .query("scanRuns")
      .withIndex("by_saleId_and_runId", (q) => q.eq("saleId", saleId).eq("runId", runId))
      .unique();
    if (run) {
      await ctx.db.patch("scanRuns", run._id, {
        status: "complete",
        stage: "complete",
        totalMs,
        completedAt,
        ...(embeddingMs === undefined ? {} : { embeddingMs }),
      });
    }
    return true;
  },
});

export const failRun = internalMutation({
  args: {
    saleId: v.id("sales"),
    runId: v.string(),
    errorCode: v.string(),
    errorMessage: v.string(),
    totalMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, { saleId, runId, errorCode, errorMessage, totalMs }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale || sale.activeRunId !== runId) return false;
    const completedAt = Date.now();
    await ctx.db.patch("sales", saleId, {
      status: "failed",
      processingStage: "failed",
      errorCode,
      errorMessage,
      completedAt,
    });
    const run = await ctx.db
      .query("scanRuns")
      .withIndex("by_saleId_and_runId", (q) => q.eq("saleId", saleId).eq("runId", runId))
      .unique();
    if (run) {
      await ctx.db.patch("scanRuns", run._id, {
        status: "failed",
        stage: "failed",
        errorCode,
        errorMessage,
        completedAt,
        ...(totalMs === undefined ? {} : { totalMs }),
      });
    }
    return true;
  },
});
