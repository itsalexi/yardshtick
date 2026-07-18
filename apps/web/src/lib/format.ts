import type { YardItem } from "@yard/contracts";

export const SCENE_WIDTH = 2048;
export const SCENE_HEIGHT = 1536;

export function php(amount: number | undefined): string {
  if (amount === undefined) return "₱—";
  return `₱${amount.toLocaleString("en-PH")}`;
}

export const conditionLabels: Record<YardItem["condition"], string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  for_parts: "For parts",
};

export const conditionOrder: YardItem["condition"][] = [
  "like_new",
  "good",
  "fair",
  "for_parts",
];
