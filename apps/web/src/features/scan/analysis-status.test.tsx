import type { SaleView } from "@yard/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AnalysisStatus } from "./analysis-status";

const discoveringSale = {
  status: "processing",
  processingStage: "discovering",
  progress: 10,
  items: [],
  error: null,
} satisfies Pick<
  SaleView,
  "status" | "processingStage" | "progress" | "items" | "error"
>;

describe("AnalysisStatus", () => {
  it("renders real progress and the current pipeline stage", () => {
    const html = renderToStaticMarkup(
      createElement(AnalysisStatus, {
        sale: discoveringSale,
        retrying: false,
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain("Finding sellable items");
    expect(html).toContain("10%");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="10"');
    expect(html).toContain("Photo ready");
    expect(html).toContain("Find items");
    expect(html).toContain("Make cutouts");
  });

  it("offers a retry instead of hanging after analysis fails", () => {
    const html = renderToStaticMarkup(
      createElement(AnalysisStatus, {
        sale: {
          ...discoveringSale,
          status: "failed",
          processingStage: "failed",
          error: { code: "PROVIDER_ERROR", message: "Vision timed out." },
        },
        retrying: false,
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain("Your photo is safe");
    expect(html).toContain("Vision timed out.");
    expect(html).toContain("Try analysis again");
  });
});
