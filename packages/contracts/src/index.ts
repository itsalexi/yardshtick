import { z } from "zod";

import { pixelBoxSchema, polygonSchema } from "./geometry";

export * from "./geometry";
export * from "./pipeline";

export const processingStageSchema = z.enum([
  "uploaded",
  "discovering",
  "segmenting",
  "generating_crops",
  "refining",
  "pricing",
  "complete",
  "failed",
]);

export const priceStrategySchema = z
  .object({
    sellTodayPhp: z.number().positive(),
    fairPhp: z.number().positive(),
    tryYourLuckPhp: z.number().positive(),
  })
  .refine(
    ({ sellTodayPhp, fairPhp, tryYourLuckPhp }) =>
      sellTodayPhp < fairPhp && fairPhp < tryYourLuckPhp,
    { message: "Prices must increase from sell today to try your luck" },
  );

export const yardItemSchema = z.object({
  id: z.string().min(1),
  selected: z.boolean(),
  title: z.string().min(1),
  category: z.string().min(1),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  condition: z.enum(["like_new", "good", "fair", "for_parts"]),
  roughBox: pixelBoxSchema,
  maskSource: z.enum(["roboflow_sam2", "bbox", "manual_box"]),
  polygons: z.array(polygonSchema).optional(),
  pricing: priceStrategySchema.optional(),
  finalPricePhp: z.number().positive().optional(),
  status: z.enum(["available", "reserved", "sold"]),
  reservedByName: z.string().min(1).optional(),
});

export const saleViewSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["draft", "processing", "ready", "published", "failed"]),
  processingStage: processingStageSchema,
  progress: z.number().min(0).max(100),
  items: z.array(yardItemSchema),
});

export const storefrontSchema = saleViewSchema.pick({
  slug: true,
  title: true,
  items: true,
});

export const sceneCandidateSchema = z.object({
  tempId: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1),
  roughBox: pixelBoxSchema,
  sellabilityConfidence: z.number().min(0).max(1),
});

export type ProcessingStage = z.infer<typeof processingStageSchema>;
export type PriceStrategy = z.infer<typeof priceStrategySchema>;
export type YardItem = z.infer<typeof yardItemSchema>;
export type SaleView = z.infer<typeof saleViewSchema>;
export type Storefront = z.infer<typeof storefrontSchema>;
export type SceneCandidate = z.infer<typeof sceneCandidateSchema>;

export type DraftImage = {
  file: Blob;
  width: number;
  height: number;
};

export interface YardService {
  createDraft(image: DraftImage): Promise<SaleView>;
  startScan(saleId: string): Promise<void>;
  getSale(saleId: string): Promise<SaleView>;
  setItemSelected(itemId: string, selected: boolean): Promise<void>;
  updateItem(itemId: string, patch: Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>): Promise<void>;
  publishSale(saleId: string): Promise<Storefront>;
  getStorefront(slug: string): Promise<Storefront>;
  reserveItem(slug: string, itemId: string, buyerName: string): Promise<void>;
}
