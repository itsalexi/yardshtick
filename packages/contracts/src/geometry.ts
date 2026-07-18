import { z } from "zod";

export const pixelBoxSchema = z.object({
  x1: z.number().finite(),
  y1: z.number().finite(),
  x2: z.number().finite(),
  y2: z.number().finite(),
});

export const pixelPointSchema = z.tuple([z.number().finite(), z.number().finite()]);
export const polygonSchema = z.array(pixelPointSchema).min(3);

export type PixelBox = z.infer<typeof pixelBoxSchema>;
export type PixelPoint = z.infer<typeof pixelPointSchema>;
