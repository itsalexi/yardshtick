import { v } from "convex/values";

export const imageMimeTypeValidator = v.union(
  v.literal("image/jpeg"),
  v.literal("image/png"),
  v.literal("image/webp"),
);

export const imageMetadataValidator = v.object({
  width: v.number(),
  height: v.number(),
  mimeType: imageMimeTypeValidator,
});

export const pixelBoxValidator = v.object({
  x1: v.number(),
  y1: v.number(),
  x2: v.number(),
  y2: v.number(),
});

export const pointValidator = v.array(v.number());
export const polygonValidator = v.array(pointValidator);
export const polygonsValidator = v.array(polygonValidator);

export const saleStatusValidator = v.union(
  v.literal("draft"),
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed"),
);

export const processingStageValidator = v.union(
  v.literal("uploaded"),
  v.literal("discovering"),
  v.literal("segmenting"),
  v.literal("complete"),
  v.literal("failed"),
);

export const runStatusValidator = v.union(
  v.literal("running"),
  v.literal("complete"),
  v.literal("failed"),
);

export const runStageValidator = v.union(
  v.literal("discovering"),
  v.literal("segmenting"),
  v.literal("complete"),
  v.literal("failed"),
);

export const maskSourceValidator = v.union(
  v.literal("pending"),
  v.literal("roboflow_sam2"),
  v.literal("bbox"),
);

export const cropStatusValidator = v.union(
  v.literal("missing"),
  v.literal("uploading"),
  v.literal("ready"),
  v.literal("failed"),
);

export const marketplaceImageStatusValidator = v.union(
  v.literal("idle"),
  v.literal("pending"),
  v.literal("generating"),
  v.literal("ready"),
  v.literal("failed"),
);

export const marketplaceJobStatusValidator = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("complete"),
  v.literal("failed"),
  v.literal("stale"),
);

export const candidateValidator = v.object({
  tempId: v.string(),
  displayName: v.string(),
  category: v.string(),
  sellabilityConfidence: v.number(),
  roughBox: pixelBoxValidator,
});

export const segmentationResultValidator = v.object({
  tempId: v.string(),
  maskSource: v.union(v.literal("roboflow_sam2"), v.literal("bbox")),
  polygons: polygonsValidator,
  refinedBox: pixelBoxValidator,
  confidence: v.optional(v.number()),
});

export const safeErrorValidator = v.object({
  code: v.string(),
  message: v.string(),
});

export const scanRunSummaryValidator = v.object({
  status: runStatusValidator,
  stage: runStageValidator,
  candidateCount: v.number(),
  polygonCount: v.number(),
  fallbackCount: v.number(),
  discoveryMs: v.optional(v.number()),
  embeddingMs: v.optional(v.number()),
  segmentationMs: v.optional(v.number()),
  totalMs: v.optional(v.number()),
});

export const sellerViewItemValidator = v.object({
  id: v.string(),
  tempId: v.string(),
  sortOrder: v.number(),
  selected: v.boolean(),
  title: v.string(),
  category: v.string(),
  confidence: v.number(),
  roughBox: pixelBoxValidator,
  refinedBox: v.union(pixelBoxValidator, v.null()),
  maskSource: maskSourceValidator,
  maskRevision: v.number(),
  polygons: polygonsValidator,
  segmentationConfidence: v.union(v.number(), v.null()),
  crop: v.object({
    status: cropStatusValidator,
    revision: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
    mimeType: v.union(imageMimeTypeValidator, v.null()),
  }),
  marketplaceImage: v.object({
    status: marketplaceImageStatusValidator,
    revision: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
    mimeType: v.union(imageMimeTypeValidator, v.null()),
    durationMs: v.union(v.number(), v.null()),
    error: v.union(safeErrorValidator, v.null()),
  }),
});

export const sellerViewValidator = v.object({
  id: v.string(),
  slug: v.string(),
  status: saleStatusValidator,
  processingStage: processingStageValidator,
  progress: v.number(),
  activeRunId: v.union(v.string(), v.null()),
  image: v.object({
    url: v.string(),
    width: v.number(),
    height: v.number(),
    mimeType: imageMimeTypeValidator,
  }),
  error: v.union(safeErrorValidator, v.null()),
  run: v.union(scanRunSummaryValidator, v.null()),
  items: v.array(sellerViewItemValidator),
});

export const sampleSaleValidator = v.object({
  id: v.string(),
  fixtureKey: v.string(),
  imageUrl: v.string(),
  status: saleStatusValidator,
});
