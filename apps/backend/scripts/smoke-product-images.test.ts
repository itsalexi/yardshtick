import type { SampleSale, ScanSellerView } from "@yard/contracts";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildCropAttachment,
  buildSafeReport,
  createPaddedJpegCrop,
  getPaddedCropRegion,
  pollMarketplaceImage,
  selectReadyTarget,
} from "./smoke-product-images";

function sellerView(
  marketplaceStatus: ScanSellerView["items"][number]["marketplaceImage"]["status"] =
    "idle",
): ScanSellerView {
  return {
    id: "sale_phone",
    slug: "phone-sale",
    status: "ready",
    processingStage: "complete",
    progress: 100,
    activeRunId: "run_phone",
    image: {
      url: "https://storage.example.test/canonical.jpeg",
      width: 1_000,
      height: 800,
      mimeType: "image/jpeg",
    },
    error: null,
    run: {
      status: "complete",
      stage: "complete",
      candidateCount: 1,
      polygonCount: 1,
      fallbackCount: 0,
    },
    items: [
      {
        id: "item_phone",
        tempId: "phone-1",
        sortOrder: 0,
        selected: true,
        title: "Apple smartphone",
        category: "electronics",
        confidence: 0.98,
        roughBox: { x1: 100, y1: 200, x2: 300, y2: 500 },
        refinedBox: { x1: 105, y1: 205, x2: 295, y2: 495 },
        maskSource: "roboflow_sam2",
        maskRevision: 3,
        polygons: [
          [
            [105, 205],
            [295, 205],
            [295, 495],
          ],
        ],
        segmentationConfidence: 0.95,
        crop: {
          status: marketplaceStatus === "idle" ? "missing" : "ready",
          revision: marketplaceStatus === "idle" ? null : 3,
          url:
            marketplaceStatus === "idle"
              ? null
              : "https://storage.example.test/crop.jpeg",
          mimeType: marketplaceStatus === "idle" ? null : "image/jpeg",
        },
        marketplaceImage: {
          status: marketplaceStatus,
          revision: marketplaceStatus === "ready" ? 3 : null,
          url:
            marketplaceStatus === "ready"
              ? "https://storage.example.test/marketplace.jpeg"
              : null,
          mimeType: marketplaceStatus === "ready" ? "image/jpeg" : null,
          durationMs: marketplaceStatus === "ready" ? 4_200 : null,
          error:
            marketplaceStatus === "failed"
              ? { code: "OPENAI_RATE_LIMITED", message: "Try again later." }
              : null,
        },
      },
    ],
  };
}

describe("getPaddedCropRegion", () => {
  it("adds six percent padding and clamps the extract region to the image", () => {
    expect(
      getPaddedCropRegion(
        { x1: 100, y1: 200, x2: 300, y2: 500 },
        { width: 1_000, height: 800 },
      ),
    ).toEqual({ left: 88, top: 182, width: 224, height: 336 });

    expect(
      getPaddedCropRegion(
        { x1: 5, y1: 10, x2: 105, y2: 110 },
        { width: 1_000, height: 800 },
      ),
    ).toEqual({ left: 0, top: 4, width: 111, height: 112 });
  });
});

describe("createPaddedJpegCrop", () => {
  it("encodes the padded rectangular fixture crop as a bounded JPEG", async () => {
    const source = await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 20, g: 40, b: 60 },
      },
    })
      .jpeg()
      .toBuffer();

    const crop = await createPaddedJpegCrop(
      new Uint8Array(source),
      { x1: 10, y1: 10, x2: 60, y2: 50 },
      { width: 100, height: 80 },
    );
    const metadata = await sharp(crop.bytes).metadata();

    expect(crop.dimensions).toEqual({ width: 56, height: 46 });
    expect(metadata).toMatchObject({ format: "jpeg", width: 56, height: 46 });
  });
});

describe("selectReadyTarget", () => {
  it("selects the first manifest fixture with a completed item mask", async () => {
    const samples: SampleSale[] = [
      {
        id: "sale_charger",
        fixtureKey: "charger-cable",
        imageUrl: "https://storage.example.test/charger.jpeg",
        status: "ready",
      },
      {
        id: "sale_phone",
        fixtureKey: "phone-single",
        imageUrl: "https://storage.example.test/phone.jpeg",
        status: "ready",
      },
    ];

    const target = await selectReadyTarget(samples, async (saleId) =>
      saleId === "sale_phone" ? sellerView() : null,
    );

    expect(target).toMatchObject({
      fixtureKey: "phone-single",
      saleId: "sale_phone",
      item: { id: "item_phone", title: "Apple smartphone", maskRevision: 3 },
    });
  });

  it("can use a completed item even when it is currently deselected", async () => {
    const view = sellerView();
    view.items[0]!.selected = false;

    const target = await selectReadyTarget(
      [
        {
          id: "sale_phone",
          fixtureKey: "phone-single",
          imageUrl: "https://storage.example.test/phone.jpeg",
          status: "ready",
        },
      ],
      async () => view,
    );

    expect(target.item.id).toBe("item_phone");
  });
});

describe("buildCropAttachment", () => {
  it("uses the selected item's exact current mask revision", () => {
    const target = sellerView().items[0]!;

    expect(buildCropAttachment(target, "storage_crop")).toEqual({
      itemId: "item_phone",
      storageId: "storage_crop",
      mimeType: "image/jpeg",
      maskRevision: 3,
    });
  });
});

describe("pollMarketplaceImage", () => {
  it("waits for a current stored JPEG while preserving the real crop", async () => {
    const views = [sellerView("generating"), sellerView("ready")];
    let now = 0;

    const outcome = await pollMarketplaceImage({
      saleId: "sale_phone",
      itemId: "item_phone",
      maskRevision: 3,
      timeoutMs: 1_000,
      pollIntervalMs: 100,
      querySellerView: async () => views.shift() ?? sellerView("ready"),
      now: () => now,
      wait: async (milliseconds) => {
        now += milliseconds;
      },
    });

    expect(outcome).toMatchObject({
      status: "ready",
      durationMs: 4_200,
      errorCode: null,
      marketplaceImageUrl: "https://storage.example.test/marketplace.jpeg",
    });
  });

  it("fails immediately if the permanent real crop fallback disappears", async () => {
    const view = sellerView("generating");
    view.items[0]!.crop = {
      status: "missing",
      revision: null,
      url: null,
      mimeType: null,
    };

    const outcome = await pollMarketplaceImage({
      saleId: "sale_phone",
      itemId: "item_phone",
      maskRevision: 3,
      timeoutMs: 1_000,
      querySellerView: async () => view,
    });

    expect(outcome).toMatchObject({
      status: "failed",
      errorCode: "CROP_FALLBACK_MISSING",
    });
  });

  it("returns a bounded timeout without leaking live state", async () => {
    let now = 0;

    const outcome = await pollMarketplaceImage({
      saleId: "sale_phone",
      itemId: "item_phone",
      maskRevision: 3,
      timeoutMs: 200,
      pollIntervalMs: 100,
      querySellerView: async () => sellerView("pending"),
      now: () => now,
      wait: async (milliseconds) => {
        now += milliseconds;
      },
    });

    expect(outcome).toEqual({
      status: "timeout",
      durationMs: 200,
      errorCode: "MARKETPLACE_IMAGE_TIMEOUT",
      marketplaceImageUrl: null,
    });
  });
});

describe("buildSafeReport", () => {
  it("keeps only safe labels, state, timing, revision, dimensions, and error code", () => {
    const report = buildSafeReport({
      fixtureKey: "phone-single",
      itemLabel: "Apple smartphone",
      status: "failed",
      durationMs: 1_200,
      revision: 3,
      dimensions: {
        crop: { width: 224, height: 336 },
        marketplace: null,
      },
      errorCode: "OPENAI_RATE_LIMITED",
    });

    expect(report).toEqual({
      fixtureKey: "phone-single",
      itemLabel: "Apple smartphone",
      status: "failed",
      durationMs: 1_200,
      revision: 3,
      dimensions: {
        crop: { width: 224, height: 336 },
        marketplace: null,
      },
      errorCode: "OPENAI_RATE_LIMITED",
    });
    expect(JSON.stringify(report)).not.toMatch(/https?:|message|api[_ -]?key|bearer/i);
  });
});
