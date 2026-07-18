import type { SampleSale, ScanSellerView } from "@yard/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabScreen } from "./App";

afterEach(cleanup);

const samples: SampleSale[] = [
  {
    id: "sale_phone",
    fixtureKey: "phone-single",
    imageUrl: "https://example.test/phone.jpeg",
    status: "draft",
  },
];

const sale: ScanSellerView = {
  id: "sale_phone",
  slug: "phone-single",
  status: "processing",
  processingStage: "segmenting",
  progress: 55,
  activeRunId: "run_1",
  image: {
    url: "https://example.test/phone.jpeg",
    width: 2048,
    height: 1536,
    mimeType: "image/jpeg",
  },
  error: null,
  run: {
    status: "running",
    stage: "segmenting",
    candidateCount: 1,
    polygonCount: 0,
    fallbackCount: 0,
    discoveryMs: 372.4,
  },
  items: [
    {
      id: "item_phone",
      tempId: "phone",
      sortOrder: 0,
      selected: true,
      title: "Smartphone",
      category: "Electronics",
      condition: "good",
      status: "available",
      confidence: 0.92,
      roughBox: { x1: 400, y1: 220, x2: 1420, y2: 1450 },
      refinedBox: null,
      maskSource: "pending",
      maskRevision: 0,
      polygons: [],
      segmentationConfidence: null,
      crop: {
        status: "missing",
        revision: null,
        url: null,
        mimeType: null,
      },
      marketplaceImage: {
        status: "idle",
        revision: null,
        url: null,
        mimeType: null,
        durationMs: null,
        error: null,
      },
    },
  ],
};

describe("LabScreen", () => {
  it("selects fixtures and shows progressive state", () => {
    const onSelectSale = vi.fn();

    render(
      <LabScreen
        samples={samples}
        sale={sale}
        selectedSaleId="sale_phone"
        selectedItemId={null}
        busy={null}
        localError={null}
        onSelectSale={onSelectSale}
        onSelectItem={vi.fn()}
        onRunScan={vi.fn()}
        onUpload={vi.fn()}
        onClear={vi.fn()}
        onCreateCrop={vi.fn()}
        onRetryMarketplaceImage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /phone-single/i }));
    expect(onSelectSale).toHaveBeenCalledWith("sale_phone");
    expect(screen.getByText("segmenting").textContent).toBe("segmenting");
    expect(screen.getByTestId("rough-box-item_phone")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /scan running/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("starts a scan for a draft sale", () => {
    const onRunScan = vi.fn();
    render(
      <LabScreen
        samples={samples}
        sale={{
          ...sale,
          status: "draft",
          processingStage: "uploaded",
          progress: 0,
          activeRunId: null,
          run: null,
          items: [],
        }}
        selectedSaleId="sale_phone"
        selectedItemId={null}
        busy={null}
        localError={null}
        onSelectSale={vi.fn()}
        onSelectItem={vi.fn()}
        onRunScan={onRunScan}
        onUpload={vi.fn()}
        onClear={vi.fn()}
        onCreateCrop={vi.fn()}
        onRetryMarketplaceImage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /run scan/i }));
    expect(onRunScan).toHaveBeenCalledOnce();
  });

  it("creates a crop for a selected segmented item", () => {
    const onCreateCrop = vi.fn();
    render(
      <LabScreen
        samples={samples}
        sale={{
          ...sale,
          status: "ready",
          processingStage: "complete",
          progress: 100,
          items: [
            {
              ...sale.items[0]!,
              maskSource: "bbox",
              maskRevision: 1,
            },
          ],
        }}
        selectedSaleId="sale_phone"
        selectedItemId="item_phone"
        busy={null}
        localError={null}
        onSelectSale={vi.fn()}
        onSelectItem={vi.fn()}
        onRunScan={vi.fn()}
        onUpload={vi.fn()}
        onClear={vi.fn()}
        onCreateCrop={onCreateCrop}
        onRetryMarketplaceImage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /create crop & enrich/i }));
    expect(onCreateCrop).toHaveBeenCalledWith("item_phone");
  });

  it("shows the permanent real crop beside a ready marketplace image", () => {
    render(
      <LabScreen
        samples={samples}
        sale={{
          ...sale,
          items: [
            {
              ...sale.items[0]!,
              maskSource: "roboflow_sam2",
              maskRevision: 1,
              crop: {
                status: "ready",
                revision: 1,
                url: "https://example.test/crop.webp",
                mimeType: "image/webp",
              },
              marketplaceImage: {
                status: "ready",
                revision: 1,
                url: "https://example.test/marketplace.jpeg",
                mimeType: "image/jpeg",
                durationMs: 4_200,
                error: null,
              },
            },
          ],
        }}
        selectedSaleId="sale_phone"
        selectedItemId="item_phone"
        busy={null}
        localError={null}
        onSelectSale={vi.fn()}
        onSelectItem={vi.fn()}
        onRunScan={vi.fn()}
        onUpload={vi.fn()}
        onClear={vi.fn()}
        onCreateCrop={vi.fn()}
        onRetryMarketplaceImage={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Real crop for Smartphone")).toBeTruthy();
    expect(screen.getByAltText("Marketplace photo for Smartphone")).toBeTruthy();
    expect(screen.getByText("4.2 s")).toBeTruthy();
  });

  it("keeps the real crop visible and offers retry after generation fails", () => {
    const onRetryMarketplaceImage = vi.fn();
    render(
      <LabScreen
        samples={samples}
        sale={{
          ...sale,
          items: [
            {
              ...sale.items[0]!,
              maskSource: "bbox",
              maskRevision: 1,
              crop: {
                status: "ready",
                revision: 1,
                url: "https://example.test/crop.webp",
                mimeType: "image/webp",
              },
              marketplaceImage: {
                status: "failed",
                revision: 1,
                url: null,
                mimeType: null,
                durationMs: 900,
                error: {
                  code: "OPENAI_RATE_LIMITED",
                  message: "OpenAI is temporarily busy.",
                },
              },
            },
          ],
        }}
        selectedSaleId="sale_phone"
        selectedItemId="item_phone"
        busy={null}
        localError={null}
        onSelectSale={vi.fn()}
        onSelectItem={vi.fn()}
        onRunScan={vi.fn()}
        onUpload={vi.fn()}
        onClear={vi.fn()}
        onCreateCrop={vi.fn()}
        onRetryMarketplaceImage={onRetryMarketplaceImage}
      />,
    );

    expect(screen.getByAltText("Real crop for Smartphone")).toBeTruthy();
    expect(screen.getByText(/real crop is still available/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry marketplace image/i }));
    expect(onRetryMarketplaceImage).toHaveBeenCalledWith("item_phone");
  });
});
