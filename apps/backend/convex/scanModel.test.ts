import type { ScanSellerView } from "@yard/contracts";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";
import schema from "./schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.*s");

const createDraft = makeFunctionReference<
  "mutation",
  {
    storageId: Id<"_storage">;
    metadata: { width: number; height: number; mimeType: "image/jpeg" };
  },
  Id<"sales">
>("sales:createDraft");
const getSellerView = makeFunctionReference<
  "query",
  { saleId: Id<"sales"> },
  ScanSellerView | null
>("sales:getSellerView");
const beginRun = makeFunctionReference<
  "mutation",
  { saleId: Id<"sales"> },
  { runId: string }
>("scanModel:beginRun");
const persistCandidates = makeFunctionReference<
  "mutation",
  {
    saleId: Id<"sales">;
    runId: string;
    candidates: Array<{
      tempId: string;
      displayName: string;
      category: string;
      sellabilityConfidence: number;
      roughBox: { x1: number; y1: number; x2: number; y2: number };
    }>;
    discoveryMs: number;
    openaiResponseId?: string;
  },
  boolean
>("scanModel:persistCandidates");
const persistSegmentation = makeFunctionReference<
  "mutation",
  {
    saleId: Id<"sales">;
    runId: string;
    results: Array<{
      tempId: string;
      maskSource: "roboflow_sam2" | "bbox";
      polygons: Array<Array<[number, number]>>;
      refinedBox: { x1: number; y1: number; x2: number; y2: number };
      confidence?: number;
    }>;
    segmentationMs: number;
  },
  boolean
>("scanModel:persistSegmentation");
const completeRun = makeFunctionReference<
  "mutation",
  {
    saleId: Id<"sales">;
    runId: string;
    embeddingMs?: number;
    totalMs: number;
  },
  boolean
>("scanModel:completeRun");

describe("scan persistence", () => {
  it("shows progressive boxes and rejects stale run writes", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["image"], { type: "image/jpeg" })),
    );
    const saleId = await t.mutation(createDraft, {
      storageId,
      metadata: { width: 2048, height: 1536, mimeType: "image/jpeg" },
    });

    const first = await t.mutation(beginRun, { saleId });
    const second = await t.mutation(beginRun, { saleId });

    await expect(
      t.mutation(persistCandidates, {
        saleId,
        runId: first.runId,
        candidates: [],
        discoveryMs: 10,
      }),
    ).resolves.toBe(false);

    await expect(
      t.mutation(persistCandidates, {
        saleId,
        runId: second.runId,
        candidates: [
          {
            tempId: "phone",
            displayName: "Phone",
            category: "Electronics",
            sellabilityConfidence: 0.9,
            roughBox: { x1: 10, y1: 10, x2: 500, y2: 700 },
          },
          {
            tempId: "charger",
            displayName: "Charger",
            category: "Electronics",
            sellabilityConfidence: 0.8,
            roughBox: { x1: 700, y1: 200, x2: 1100, y2: 650 },
          },
        ],
        discoveryMs: 120,
        openaiResponseId: "resp_1",
      }),
    ).resolves.toBe(true);

    const progressive = await t.query(getSellerView, { saleId });
    expect(progressive).toMatchObject({
      status: "processing",
      processingStage: "segmenting",
      progress: 55,
      activeRunId: second.runId,
    });
    expect(progressive?.items.map(({ maskSource }) => maskSource)).toEqual([
      "pending",
      "pending",
    ]);

    await expect(
      t.mutation(persistSegmentation, {
        saleId,
        runId: second.runId,
        results: [
          {
            tempId: "phone",
            maskSource: "roboflow_sam2",
            polygons: [
              [
                [20, 20],
                [480, 20],
                [480, 680],
                [20, 680],
              ],
            ],
            refinedBox: { x1: 20, y1: 20, x2: 480, y2: 680 },
            confidence: 0.91,
          },
          {
            tempId: "charger",
            maskSource: "bbox",
            polygons: [],
            refinedBox: { x1: 700, y1: 200, x2: 1100, y2: 650 },
          },
        ],
        segmentationMs: 240,
      }),
    ).resolves.toBe(true);
    await expect(
      t.mutation(completeRun, {
        saleId,
        runId: second.runId,
        embeddingMs: 80,
        totalMs: 410,
      }),
    ).resolves.toBe(true);

    const complete = await t.query(getSellerView, { saleId });
    expect(complete).toMatchObject({
      status: "ready",
      processingStage: "complete",
      progress: 100,
      run: {
        status: "complete",
        stage: "complete",
        candidateCount: 2,
        polygonCount: 1,
        fallbackCount: 1,
      },
    });
    expect(complete?.items[0]).toMatchObject({
      maskSource: "roboflow_sam2",
      maskRevision: 1,
      polygons: [
        [
          [20, 20],
          [480, 20],
          [480, 680],
          [20, 680],
        ],
      ],
    });
    expect(complete?.items[1]).toMatchObject({
      maskSource: "bbox",
      maskRevision: 1,
      polygons: [],
    });
  });
});
