import type { SaleView } from "@yard/contracts";
import { describe, expect, it } from "vitest";

import { getScanPresentation } from "./presentation";

function sale(
  overrides: Partial<
    Pick<SaleView, "status" | "processingStage" | "progress" | "items" | "error">
  > = {},
) {
  return {
    status: "processing",
    processingStage: "discovering",
    progress: 10,
    items: [],
    error: null,
    ...overrides,
  } satisfies Pick<
    SaleView,
    "status" | "processingStage" | "progress" | "items" | "error"
  >;
}

describe("getScanPresentation", () => {
  it("starts by confirming the uploaded photo", () => {
    expect(
      getScanPresentation(
        sale({ status: "draft", processingStage: "uploaded", progress: 0 }),
      ),
    ).toMatchObject({
      eyebrow: "Photo uploaded",
      title: "Opening your scene",
      activeStep: 0,
      progress: 0,
    });
  });

  it("describes discovery using the real backend progress", () => {
    expect(getScanPresentation(sale())).toMatchObject({
      eyebrow: "Yard vision is working",
      title: "Finding sellable items",
      detail: "Looking across the whole scene, including the edges.",
      progress: 10,
      activeStep: 1,
      foundCount: 0,
      failed: false,
    });
  });

  it("surfaces progressive item counts while cutouts are prepared", () => {
    expect(
      getScanPresentation(
        sale({
          processingStage: "segmenting",
          progress: 55,
          items: [{ id: "one" }, { id: "two" }] as SaleView["items"],
        }),
      ),
    ).toMatchObject({
      title: "Preparing 2 item cutouts",
      progress: 55,
      activeStep: 2,
      foundCount: 2,
    });
  });

  it("turns a failed scan into a recoverable state", () => {
    expect(
      getScanPresentation(
        sale({
          status: "failed",
          processingStage: "failed",
          progress: 55,
          error: { code: "PROVIDER_ERROR", message: "Vision provider timed out." },
        }),
      ),
    ).toMatchObject({
      eyebrow: "Analysis paused",
      title: "Your photo is safe",
      detail: "Vision provider timed out.",
      failed: true,
    });
  });

  it("marks every real stage complete when the scene is ready", () => {
    expect(
      getScanPresentation(
        sale({ status: "ready", processingStage: "complete", progress: 100 }),
      ),
    ).toMatchObject({
      eyebrow: "Analysis complete",
      title: "Your scene is ready",
      progress: 100,
      activeStep: 3,
      failed: false,
    });
  });
});
