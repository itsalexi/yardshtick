import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  cropStatusValidator,
  imageMimeTypeValidator,
  maskSourceValidator,
  marketplaceImageStatusValidator,
  marketplaceJobStatusValidator,
  pixelBoxValidator,
  polygonsValidator,
  processingStageValidator,
  runStageValidator,
  runStatusValidator,
  saleStatusValidator,
} from "./lib/validators";

export default defineSchema({
  sales: defineTable({
    slug: v.string(),
    fixtureKey: v.optional(v.string()),
    imageStorageId: v.id("_storage"),
    imageMimeType: imageMimeTypeValidator,
    imageWidth: v.number(),
    imageHeight: v.number(),
    roboflowImageId: v.string(),
    status: saleStatusValidator,
    processingStage: processingStageValidator,
    progress: v.number(),
    activeRunId: v.optional(v.string()),
    promptVersion: v.string(),
    providerVersion: v.string(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_fixtureKey", ["fixtureKey"])
    .index("by_createdAt", ["createdAt"]),
  items: defineTable({
    saleId: v.id("sales"),
    tempId: v.string(),
    sortOrder: v.number(),
    selected: v.boolean(),
    source: v.literal("ai"),
    title: v.string(),
    category: v.string(),
    confidence: v.number(),
    roughBox: pixelBoxValidator,
    refinedBox: v.optional(pixelBoxValidator),
    maskSource: maskSourceValidator,
    segmentationConfidence: v.optional(v.number()),
    maskRevision: v.number(),
    cropStorageId: v.optional(v.id("_storage")),
    cropMimeType: v.optional(imageMimeTypeValidator),
    cropRevision: v.optional(v.number()),
    cropStatus: cropStatusValidator,
    marketplaceImageStorageId: v.optional(v.id("_storage")),
    marketplaceImageJobId: v.optional(v.id("marketplaceImageJobs")),
    marketplaceImageRevision: v.optional(v.number()),
    marketplaceImageMimeType: v.optional(imageMimeTypeValidator),
    marketplaceImageMs: v.optional(v.number()),
    marketplaceImageErrorCode: v.optional(v.string()),
    marketplaceImageErrorMessage: v.optional(v.string()),
    marketplaceImageStatus: marketplaceImageStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_saleId", ["saleId"])
    .index("by_saleId_and_selected", ["saleId", "selected"]),
  itemMasks: defineTable({
    itemId: v.id("items"),
    revision: v.number(),
    polygons: polygonsValidator,
    promptBox: pixelBoxValidator,
    promptPoints: v.array(
      v.object({ x: v.number(), y: v.number(), positive: v.boolean() }),
    ),
    provider: v.string(),
    model: v.string(),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_itemId", ["itemId"])
    .index("by_itemId_and_revision", ["itemId", "revision"]),
  scanRuns: defineTable({
    saleId: v.id("sales"),
    runId: v.string(),
    status: runStatusValidator,
    stage: runStageValidator,
    discoveryMs: v.optional(v.number()),
    embeddingMs: v.optional(v.number()),
    segmentationMs: v.optional(v.number()),
    totalMs: v.optional(v.number()),
    candidateCount: v.number(),
    polygonCount: v.number(),
    fallbackCount: v.number(),
    openaiResponseId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_saleId", ["saleId"])
    .index("by_saleId_and_runId", ["saleId", "runId"]),
  marketplaceImageJobs: defineTable({
    itemId: v.id("items"),
    cropStorageId: v.id("_storage"),
    cropRevision: v.number(),
    mimeType: imageMimeTypeValidator,
    status: marketplaceJobStatusValidator,
    generatedStorageId: v.optional(v.id("_storage")),
    durationMs: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_itemId", ["itemId"])
    .index("by_itemId_and_cropRevision", ["itemId", "cropRevision"]),
});
