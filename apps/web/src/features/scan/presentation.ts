import type { SaleView } from "@yard/contracts";

type ScanSale = Pick<
  SaleView,
  "status" | "processingStage" | "progress" | "items" | "error"
>;

export type ScanPresentation = {
  eyebrow: string;
  title: string;
  detail: string;
  progress: number;
  activeStep: 0 | 1 | 2 | 3;
  foundCount: number;
  failed: boolean;
};

export function getScanPresentation(sale: ScanSale): ScanPresentation {
  const progress = Math.min(100, Math.max(0, Math.round(sale.progress)));
  const foundCount = sale.items.length;

  if (sale.status === "failed" || sale.processingStage === "failed") {
    return {
      eyebrow: "Analysis paused",
      title: "Your photo is safe",
      detail: sale.error?.message ?? "We could not finish analyzing this scene.",
      progress,
      activeStep: 2,
      foundCount,
      failed: true,
    };
  }

  if (sale.processingStage === "complete") {
    return {
      eyebrow: "Analysis complete",
      title: "Your scene is ready",
      detail: "Review what we found and choose what to sell.",
      progress: 100,
      activeStep: 3,
      foundCount,
      failed: false,
    };
  }

  if (sale.processingStage === "segmenting") {
    const itemLabel = `${foundCount} item${foundCount === 1 ? "" : "s"}`;
    return {
      eyebrow: foundCount > 0 ? `${itemLabel} found` : "Objects found",
      title: `Preparing ${foundCount} item cutout${foundCount === 1 ? "" : "s"}`,
      detail: "Separating each object from the background for clean listings.",
      progress,
      activeStep: 2,
      foundCount,
      failed: false,
    };
  }

  if (sale.processingStage === "discovering") {
    return {
      eyebrow: "Yard vision is working",
      title: "Finding sellable items",
      detail: "Looking across the whole scene, including the edges.",
      progress,
      activeStep: 1,
      foundCount,
      failed: false,
    };
  }

  return {
    eyebrow: "Photo uploaded",
    title: "Opening your scene",
    detail: "Preparing the full-resolution photo for analysis.",
    progress,
    activeStep: 0,
    foundCount,
    failed: false,
  };
}
