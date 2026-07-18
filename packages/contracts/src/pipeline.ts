import { z } from "zod";

import { pixelBoxSchema, polygonSchema } from "./geometry";

export const imageMimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const imageMetadataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: imageMimeTypeSchema,
});

export const safeErrorSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/),
  message: z
    .string()
    .max(240)
    .refine((value) => !/(sk-[A-Za-z0-9_-]+|api[_ -]?key|bearer\s+)/i.test(value), {
      message: "Error messages must not contain credentials",
    }),
});

export const cropStateSchema = z.object({
  status: z.enum(["missing", "uploading", "ready", "failed"]),
  revision: z.number().int().nonnegative().nullable(),
  url: z.string().url().nullable(),
  mimeType: imageMimeTypeSchema.nullable(),
});

export const marketplaceImageStateSchema = z.object({
  status: z.enum(["idle", "pending", "generating", "ready", "failed"]),
  revision: z.number().int().nonnegative().nullable(),
  url: z.string().url().nullable(),
  mimeType: imageMimeTypeSchema.nullable(),
  durationMs: z.number().nonnegative().nullable(),
  error: safeErrorSchema.nullable(),
});

export const scanItemSchema = z.object({
  id: z.string().min(1),
  tempId: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  selected: z.boolean(),
  title: z.string().min(1),
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  roughBox: pixelBoxSchema,
  refinedBox: pixelBoxSchema.nullable(),
  maskSource: z.enum(["pending", "roboflow_sam2", "bbox"]),
  maskRevision: z.number().int().nonnegative(),
  polygons: z.array(polygonSchema),
  segmentationConfidence: z.number().min(0).max(1).nullable(),
  crop: cropStateSchema,
  marketplaceImage: marketplaceImageStateSchema,
  condition: z.enum(["like_new", "good", "fair", "for_parts"]).default("good"),
  finalPricePhp: z.number().positive().optional(),
  status: z.enum(["available", "reserved", "sold"]).default("available"),
  reservedByName: z.string().min(1).optional(),
});

export const scanRunSummarySchema = z.object({
  status: z.enum(["running", "complete", "failed"]),
  stage: z.enum(["discovering", "segmenting", "complete", "failed"]),
  candidateCount: z.number().int().nonnegative(),
  polygonCount: z.number().int().nonnegative().default(0),
  fallbackCount: z.number().int().nonnegative().default(0),
  discoveryMs: z.number().nonnegative().optional(),
  embeddingMs: z.number().nonnegative().optional(),
  segmentationMs: z.number().nonnegative().optional(),
  totalMs: z.number().nonnegative().optional(),
});

export const scanSellerViewSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["draft", "processing", "ready", "published", "failed"]),
  processingStage: z.enum(["uploaded", "discovering", "segmenting", "complete", "failed"]),
  progress: z.number().min(0).max(100),
  activeRunId: z.string().nullable(),
  image: imageMetadataSchema.extend({
    url: z.string().url(),
  }),
  error: safeErrorSchema.nullable(),
  run: scanRunSummarySchema.nullable(),
  items: z.array(scanItemSchema),
});

export const createDraftInputSchema = z.object({
  storageId: z.string().min(1),
  metadata: imageMetadataSchema,
});

export const attachCropInputSchema = z.object({
  itemId: z.string().min(1),
  storageId: z.string().min(1),
  mimeType: imageMimeTypeSchema,
  maskRevision: z.number().int().nonnegative(),
});

export const sampleSaleSchema = z.object({
  id: z.string().min(1),
  fixtureKey: z.string().min(1),
  imageUrl: z.string().url(),
  status: z.enum(["draft", "processing", "ready", "published", "failed"]),
});

export type ImageMimeType = z.infer<typeof imageMimeTypeSchema>;
export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type SafeError = z.infer<typeof safeErrorSchema>;
export type CropState = z.infer<typeof cropStateSchema>;
export type MarketplaceImageState = z.infer<typeof marketplaceImageStateSchema>;
export type ScanItem = z.infer<typeof scanItemSchema>;
export type ScanRunSummary = z.infer<typeof scanRunSummarySchema>;
export type ScanSellerView = z.infer<typeof scanSellerViewSchema>;
export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;
export type AttachCropInput = z.infer<typeof attachCropInputSchema>;
export type SampleSale = z.infer<typeof sampleSaleSchema>;
