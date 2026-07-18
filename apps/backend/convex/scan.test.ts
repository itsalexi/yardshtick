import { describe, expect, it, vi } from "vitest";

import { runScanPipeline } from "./scan";

const phoneCandidate = {
  tempId: "phone",
  displayName: "Phone",
  category: "Electronics",
  sellabilityConfidence: 0.92,
  roughBox: { x1: 100, y1: 100, x2: 800, y2: 1200 },
};

describe("runScanPipeline", () => {
  it("persists candidates before segmentation and degrades provider failures to boxes", async () => {
    const events: string[] = [];
    let persistedResults: unknown[] = [];

    const result = await runScanPipeline({
      discover: async () => {
        events.push("discovery:start");
        return { responseId: "resp_1", candidates: [phoneCandidate] };
      },
      embed: async () => {
        events.push("embed:start");
        throw new Error("embedding unavailable");
      },
      segment: async () => {
        events.push("segment:start");
        throw new Error("segmentation unavailable");
      },
      persistCandidates: async () => {
        events.push("candidates:persisted");
        return true;
      },
      persistSegmentation: async ({ results }) => {
        events.push("masks:persisted");
        persistedResults = results;
        return true;
      },
    });

    expect(events.slice(0, 2).sort()).toEqual(["discovery:start", "embed:start"]);
    expect(events.indexOf("candidates:persisted")).toBeLessThan(
      events.indexOf("segment:start"),
    );
    expect(persistedResults).toEqual([
      {
        tempId: "phone",
        maskSource: "bbox",
        polygons: [],
        refinedBox: phoneCandidate.roughBox,
      },
    ]);
    expect(result).toMatchObject({
      stale: false,
      candidateCount: 1,
      polygonCount: 0,
      fallbackCount: 1,
    });
  });

  it("completes a valid zero-candidate result without calling segmentation", async () => {
    const segment = vi.fn();
    const persistSegmentation = vi.fn(async () => true);

    const result = await runScanPipeline({
      discover: async () => ({ candidates: [] }),
      embed: async () => ({ imageId: "scene", providerTimeSeconds: 0.1 }),
      segment,
      persistCandidates: async () => true,
      persistSegmentation,
    });

    expect(segment).not.toHaveBeenCalled();
    expect(persistSegmentation).toHaveBeenCalledWith({ results: [], segmentationMs: 0 });
    expect(result).toMatchObject({
      stale: false,
      candidateCount: 0,
      polygonCount: 0,
      fallbackCount: 0,
    });
  });
});
