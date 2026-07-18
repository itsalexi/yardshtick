import { describe, expect, it } from "vitest";

import { saleViewSchema } from "./index";

const validSale = {
  id: "sale_demo",
  slug: "alexis-garage-sale",
  title: "Alexi's Garage Sale",
  status: "ready",
  processingStage: "complete",
  progress: 100,
  items: [
    {
      id: "item_camera",
      selected: true,
      title: "Fujifilm Instax Mini 12",
      category: "Cameras",
      condition: "good",
      roughBox: { x1: 120, y1: 160, x2: 520, y2: 610 },
      maskSource: "roboflow_sam2",
      polygons: [[[140, 180], [500, 180], [500, 590], [140, 590]]],
      pricing: { sellTodayPhp: 2600, fairPhp: 3200, tryYourLuckPhp: 3800 },
      finalPricePhp: 3200,
      status: "available",
    },
  ],
};

describe("saleViewSchema", () => {
  it("accepts a complete demo sale", () => {
    expect(saleViewSchema.parse(validSale)).toEqual(validSale);
  });

  it("rejects a non-positive final price", () => {
    const invalidSale = structuredClone(validSale);
    invalidSale.items[0]!.finalPricePhp = 0;

    expect(() => saleViewSchema.parse(invalidSale)).toThrow();
  });
});
