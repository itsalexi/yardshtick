import { describe, expect, it } from "vitest";

import {
  attachCropInputSchema,
  createDraftInputSchema,
  sampleSaleSchema,
  scanSellerViewSchema,
} from "./pipeline";

const baseSale = {
  id: "sale_1",
  slug: "sale-1",
  status: "processing",
  processingStage: "segmenting",
  progress: 60,
  image: {
    url: "https://example.test/scene.jpeg",
    width: 2048,
    height: 1536,
    mimeType: "image/jpeg",
  },
  activeRunId: "run_1",
  error: null,
  run: {
    status: "running",
    stage: "segmenting",
    candidateCount: 1,
    polygonCount: 0,
    fallbackCount: 0,
  },
};

const missingEnrichmentState = {
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
} as const;

const baseItem = {
  id: "item_1",
  tempId: "candidate-1",
  sortOrder: 0,
  selected: true,
  title: "Phone",
  category: "Electronics",
  confidence: 0.91,
  roughBox: { x1: 100, y1: 100, x2: 900, y2: 1300 },
  refinedBox: null,
  maskSource: "pending",
  maskRevision: 0,
  polygons: [],
  segmentationConfidence: null,
  ...missingEnrichmentState,
} as const;

describe("scanSellerViewSchema", () => {
  it("accepts a candidate before its polygon is ready", () => {
    const parsed = scanSellerViewSchema.parse({
      ...baseSale,
      items: [baseItem],
    });

    expect(parsed.items[0]?.maskSource).toBe("pending");
    expect(parsed.items[0]?.crop.status).toBe("missing");
    expect(parsed.items[0]?.marketplaceImage.status).toBe("idle");
  });

  it("accepts a pending marketplace image while keeping the real crop ready", () => {
    const parsed = scanSellerViewSchema.parse({
      ...baseSale,
      items: [
        {
          ...baseItem,
          crop: {
            status: "ready",
            revision: 1,
            url: "https://example.test/crop.webp",
            mimeType: "image/webp",
          },
          marketplaceImage: {
            status: "pending",
            revision: 1,
            url: null,
            mimeType: null,
            durationMs: null,
            error: null,
          },
        },
      ],
    });

    expect(parsed.items[0]?.marketplaceImage.status).toBe("pending");
    expect(parsed.items[0]?.crop.url).toBe("https://example.test/crop.webp");
  });

  it("accepts a ready marketplace image", () => {
    const parsed = scanSellerViewSchema.parse({
      ...baseSale,
      items: [
        {
          ...baseItem,
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
            durationMs: 5_200,
            error: null,
          },
        },
      ],
    });

    expect(parsed.items[0]?.marketplaceImage.url).toBe(
      "https://example.test/marketplace.jpeg",
    );
  });

  it("keeps the real crop available when marketplace generation fails", () => {
    const parsed = scanSellerViewSchema.parse({
      ...baseSale,
      items: [
        {
          ...baseItem,
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
            durationMs: 2_400,
            error: {
              code: "IMAGE_GENERATION_FAILED",
              message: "Marketplace image generation failed",
            },
          },
        },
      ],
    });

    expect(parsed.items[0]?.crop.url).toBe("https://example.test/crop.webp");
    expect(parsed.items[0]?.marketplaceImage.error?.code).toBe(
      "IMAGE_GENERATION_FAILED",
    );
  });

  it("rejects secrets in marketplace image errors", () => {
    expect(() =>
      scanSellerViewSchema.parse({
        ...baseSale,
        items: [
          {
            ...baseItem,
            marketplaceImage: {
              status: "failed",
              revision: 1,
              url: null,
              mimeType: null,
              durationMs: 2_400,
              error: { code: "IMAGE_FAILED", message: "api key sk-secret" },
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts a completed zero-candidate scan", () => {
    const parsed = scanSellerViewSchema.parse({
      ...baseSale,
      status: "ready",
      processingStage: "complete",
      progress: 100,
      run: {
        ...baseSale.run,
        status: "complete",
        stage: "complete",
        candidateCount: 0,
      },
      items: [],
    });

    expect(parsed.items).toEqual([]);
  });

  it("rejects secrets in user-facing errors", () => {
    expect(() =>
      scanSellerViewSchema.parse({
        ...baseSale,
        status: "failed",
        processingStage: "failed",
        error: { code: "OPENAI_FAILED", message: "Bearer sk-secret" },
        items: [],
      }),
    ).toThrow();
  });
});

describe("pipeline inputs", () => {
  it("accepts a revisioned crop attachment", () => {
    expect(
      attachCropInputSchema.parse({
        itemId: "item_1",
        storageId: "storage_1",
        mimeType: "image/webp",
        maskRevision: 2,
      }),
    ).toEqual({
      itemId: "item_1",
      storageId: "storage_1",
      mimeType: "image/webp",
      maskRevision: 2,
    });
  });

  it("accepts supported canonical image metadata", () => {
    expect(
      createDraftInputSchema.parse({
        storageId: "storage_1",
        metadata: { width: 2048, height: 1536, mimeType: "image/webp" },
      }),
    ).toEqual({
      storageId: "storage_1",
      metadata: { width: 2048, height: 1536, mimeType: "image/webp" },
    });
  });

  it("requires a stable fixture key for seeded sales", () => {
    expect(() =>
      sampleSaleSchema.parse({
        id: "sale_1",
        fixtureKey: "",
        imageUrl: "https://example.test/fixture.jpeg",
        status: "draft",
      }),
    ).toThrow();
  });
});
