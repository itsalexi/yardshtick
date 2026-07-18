import { describe, expect, it } from "vitest";

import {
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

describe("scanSellerViewSchema", () => {
  it("accepts a candidate before its polygon is ready", () => {
    const parsed = scanSellerViewSchema.parse({
      ...baseSale,
      items: [
        {
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
        },
      ],
    });

    expect(parsed.items[0]?.maskSource).toBe("pending");
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
