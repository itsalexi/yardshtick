import { describe, expect, it, vi } from "vitest";

import partialSegmentation from "../test/fixtures/providers/roboflow-segmentation-partial.json";
import { embedScene, segmentCandidates } from "./roboflow";

const candidates = [
  {
    tempId: "one",
    displayName: "One",
    category: "Other",
    sellabilityConfidence: 0.9,
    roughBox: { x1: 100, y1: 100, x2: 400, y2: 400 },
  },
  {
    tempId: "two",
    displayName: "Two",
    category: "Other",
    sellabilityConfidence: 0.8,
    roughBox: { x1: 500, y1: 100, x2: 800, y2: 400 },
  },
];

describe("embedScene", () => {
  it("uses the stable scene id and selected SAM 2 model", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://serverless.roboflow.com/sam2/embed_image?api_key=test-key",
      );
      expect(JSON.parse(String(init?.body))).toMatchObject({
        image: { type: "base64", value: "AQ==" },
        image_id: "scene-stable",
        sam2_version_id: "hiera_tiny",
      });
      return new Response(JSON.stringify({ image_id: "scene-stable", time: 0.12 }), {
        status: 200,
      });
    });

    await expect(
      embedScene({
        apiKey: "test-key",
        baseUrl: "https://serverless.roboflow.com",
        image: new Uint8Array([1]),
        imageId: "scene-stable",
        fetcher,
      }),
    ).resolves.toEqual({ imageId: "scene-stable", providerTimeSeconds: 0.12 });
  });
});

describe("segmentCandidates", () => {
  it("maps valid predictions by prompt order and falls back missing predictions", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        image: { type: "base64", value: "AQ==" },
        image_id: "scene-stable",
        prompts: {
          prompts: [
            { box: { x: 250, y: 250, width: 300, height: 300 } },
            { box: { x: 650, y: 250, width: 300, height: 300 } },
          ],
        },
        sam2_version_id: "hiera_tiny",
        multimask_output: false,
        format: "json",
      });
      return new Response(JSON.stringify(partialSegmentation), { status: 200 });
    });

    const result = await segmentCandidates({
      apiKey: "test-key",
      baseUrl: "https://serverless.roboflow.com",
      image: new Uint8Array([1]),
      imageId: "scene-stable",
      width: 1000,
      height: 800,
      candidates,
      fetcher,
    });

    expect(result.items.map(({ maskSource }) => maskSource)).toEqual([
      "roboflow_sam2",
      "bbox",
    ]);
    expect(result.items[0]).toMatchObject({
      tempId: "one",
      refinedBox: { x1: 100, y1: 100, x2: 400, y2: 400 },
      confidence: 0.91,
    });
    expect(result.polygonCount).toBe(1);
    expect(result.fallbackCount).toBe(1);
  });

  it("falls back when a prediction has invalid geometry", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          predictions: [
            {
              confidence: 0.2,
              masks: [[[100, 100], [101, 100], [100, 101]]],
              format: "polygon",
            },
          ],
          time: 0.1,
        }),
        { status: 200 },
      ),
    );

    const result = await segmentCandidates({
      apiKey: "test-key",
      baseUrl: "https://serverless.roboflow.com/",
      image: new Uint8Array([1]),
      imageId: "scene-stable",
      width: 1000,
      height: 800,
      candidates: candidates.slice(0, 1),
      fetcher,
    });

    expect(result.items[0]).toMatchObject({
      maskSource: "bbox",
      polygons: [],
      refinedBox: candidates[0]?.roughBox,
    });
  });

  it("caps a valid detailed mask at 350 vertices", async () => {
    const detailedPolygon = Array.from({ length: 500 }, (_, index) => {
      const angle = (index / 500) * Math.PI * 2;
      return [500 + Math.cos(angle) * 300, 400 + Math.sin(angle) * 250];
    });
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          predictions: [
            {
              confidence: 0.95,
              masks: [detailedPolygon],
              format: "polygon",
            },
          ],
          time: 0.2,
        }),
        { status: 200 },
      ),
    );

    const result = await segmentCandidates({
      apiKey: "test-key",
      baseUrl: "https://serverless.roboflow.com",
      image: new Uint8Array([1]),
      imageId: "scene-stable",
      width: 1000,
      height: 800,
      candidates: [
        {
          ...candidates[0]!,
          roughBox: { x1: 150, y1: 100, x2: 850, y2: 700 },
        },
      ],
      fetcher,
    });

    expect(result.items[0]?.maskSource).toBe("roboflow_sam2");
    expect(result.items[0]?.polygons.flat()).toHaveLength(350);
  });
});
