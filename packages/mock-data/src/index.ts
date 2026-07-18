import { saleViewSchema, storefrontSchema } from "@yard/contracts";

const itemSeed = [
  ["camera", "Fujifilm Instax Mini 12", "Cameras", 3200],
  ["speaker", "JBL Flip 6 Speaker", "Audio", 4200],
  ["shoes", "Nike Running Shoes", "Shoes", 1800],
  ["bag", "Canvas Weekender Bag", "Bags", 1400],
  ["keyboard", "Keychron Mechanical Keyboard", "Computers", 3600],
  ["lamp", "Adjustable Desk Lamp", "Home", 850],
] as const;

const items = itemSeed.map(([id, title, category, fairPhp], index) => {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const x1 = 100 + column * 600;
  const y1 = 120 + row * 600;

  return {
    id: `item_${id}`,
    selected: true,
    title,
    category,
    condition: "good" as const,
    roughBox: { x1, y1, x2: x1 + 430, y2: y1 + 420 },
    maskSource: index < 5 ? ("roboflow_sam2" as const) : ("bbox" as const),
    polygons:
      index < 5
        ? [[[x1 + 20, y1 + 10], [x1 + 410, y1 + 20], [x1 + 400, y1 + 400], [x1 + 15, y1 + 390]]]
        : undefined,
    pricing: {
      sellTodayPhp: fairPhp - 500,
      fairPhp,
      tryYourLuckPhp: fairPhp + 600,
    },
    finalPricePhp: fairPhp,
    status: "available" as const,
  };
});

export const demoSale = saleViewSchema.parse({
  id: "sale_demo",
  slug: "alexis-garage-sale",
  title: "Alexi's Garage Sale",
  status: "ready",
  processingStage: "complete",
  progress: 100,
  items,
});

export const demoStorefront = storefrontSchema.parse({
  slug: demoSale.slug,
  title: demoSale.title,
  items: demoSale.items,
});
