import type { SampleSale, ScanSellerView } from "@yard/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LabScreen } from "./App";

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
      confidence: 0.92,
      roughBox: { x1: 400, y1: 220, x2: 1420, y2: 1450 },
      refinedBox: null,
      maskSource: "pending",
      maskRevision: 0,
      polygons: [],
      segmentationConfidence: null,
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /run scan/i }));
    expect(onRunScan).toHaveBeenCalledOnce();
  });
});
