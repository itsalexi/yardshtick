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
  status: z.enum(["draft", "processing", "ready", "failed"]),
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

export const sampleSaleSchema = z.object({
  id: z.string().min(1),
  fixtureKey: z.string().min(1),
  imageUrl: z.string().url(),
  status: z.enum(["draft", "processing", "ready", "failed"]),
});

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type SafeError = z.infer<typeof safeErrorSchema>;
export type ScanItem = z.infer<typeof scanItemSchema>;
export type ScanRunSummary = z.infer<typeof scanRunSummarySchema>;
export type ScanSellerView = z.infer<typeof scanSellerViewSchema>;
export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;
export type SampleSale = z.infer<typeof sampleSaleSchema>;
