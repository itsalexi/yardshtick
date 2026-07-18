import type { PixelBox, PixelPoint, SceneCandidate } from "@yard/contracts";
import { z } from "zod";

import { pixelBoxToRoboflowBox } from "./coordinates";
import { ProviderError, providerHttpError, type ProviderFetcher } from "./provider-error";

type RoboflowInput = {
  apiKey: string;
  baseUrl: string;
  image: Uint8Array;
  imageId: string;
  fetcher?: ProviderFetcher;
  signal?: AbortSignal;
};

export type EmbedSceneInput = RoboflowInput;

export type SegmentCandidatesInput = RoboflowInput & {
  width: number;
  height: number;
  candidates: SceneCandidate[];
};

export type EmbedResult = {
  imageId: string;
  providerTimeSeconds: number;
};

export type SegmentationItem = {
  tempId: string;
  maskSource: "roboflow_sam2" | "bbox";
  polygons: PixelPoint[][];
  refinedBox: PixelBox;
  confidence?: number;
};

export type SegmentationResult = {
  items: SegmentationItem[];
  polygonCount: number;
  fallbackCount: number;
  providerTimeSeconds?: number;
};

const pointSchema = z.tuple([z.number().finite(), z.number().finite()]);
const predictionSchema = z.object({
  confidence: z.number().finite(),
  masks: z.array(z.array(pointSchema)),
  format: z.string(),
});
const segmentationEnvelopeSchema = z.object({
  predictions: z.array(z.unknown()),
  time: z.number().finite().nonnegative().optional(),
});
const embedResponseSchema = z.object({
  image_id: z.string().min(1),
  time: z.number().finite().nonnegative(),
});

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function providerUrl(baseUrl: string, path: string, apiKey: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}?api_key=${encodeURIComponent(apiKey)}`;
}

function polygonArea(points: PixelPoint[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area) / 2;
}

function normalizeContour(
  raw: Array<[number, number]>,
  width: number,
  height: number,
): PixelPoint[] {
  const points: PixelPoint[] = [];
  for (const [rawX, rawY] of raw) {
    const point: PixelPoint = [
      Math.min(width, Math.max(0, rawX)),
      Math.min(height, Math.max(0, rawY)),
    ];
    const previous = points.at(-1);
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) points.push(point);
  }

  if (points.length > 1) {
    const first = points[0]!;
    const last = points.at(-1)!;
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }

  return new Set(points.map(([x, y]) => `${x}:${y}`)).size >= 3 ? points : [];
}

function samplePolygon(points: PixelPoint[], limit: number) {
  if (points.length <= limit) return points;
  return Array.from({ length: limit }, (_, index) =>
    points[Math.floor((index * points.length) / limit)]!,
  );
}

function capPolygons(polygons: PixelPoint[][], maximum = 350) {
  if (polygons.reduce((sum, polygon) => sum + polygon.length, 0) <= maximum) return polygons;

  const sorted = [...polygons].sort((a, b) => polygonArea(b) - polygonArea(a));
  const capped: PixelPoint[][] = [];
  let remaining = maximum;
  for (const polygon of sorted) {
    if (remaining < 3) break;
    const sampled = samplePolygon(polygon, remaining);
    if (sampled.length >= 3) {
      capped.push(sampled);
      remaining -= sampled.length;
    }
  }
  return capped;
}

function boundsFor(polygons: PixelPoint[][]): PixelBox {
  const points = polygons.flat();
  return {
    x1: Math.min(...points.map(([x]) => x)),
    y1: Math.min(...points.map(([, y]) => y)),
    x2: Math.max(...points.map(([x]) => x)),
    y2: Math.max(...points.map(([, y]) => y)),
  };
}

function boxesIntersect(a: PixelBox, b: PixelBox) {
  return Math.min(a.x2, b.x2) > Math.max(a.x1, b.x1) && Math.min(a.y2, b.y2) > Math.max(a.y1, b.y1);
}

function boxIou(a: PixelBox, b: PixelBox) {
  const width = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const height = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const intersection = width * height;
  const aArea = (a.x2 - a.x1) * (a.y2 - a.y1);
  const bArea = (b.x2 - b.x1) * (b.y2 - b.y1);
  return intersection / (aArea + bArea - intersection);
}

function centroidInsideExpandedBox(polygons: PixelPoint[][], box: PixelBox) {
  const points = polygons.flat();
  const centroid = points.reduce(
    (sum, [x, y]) => [sum[0] + x, sum[1] + y] as PixelPoint,
    [0, 0] as PixelPoint,
  );
  centroid[0] /= points.length;
  centroid[1] /= points.length;
  const paddingX = (box.x2 - box.x1) * 0.2;
  const paddingY = (box.y2 - box.y1) * 0.2;
  return (
    centroid[0] >= box.x1 - paddingX &&
    centroid[0] <= box.x2 + paddingX &&
    centroid[1] >= box.y1 - paddingY &&
    centroid[1] <= box.y2 + paddingY
  );
}

function fallback(candidate: SceneCandidate): SegmentationItem {
  return {
    tempId: candidate.tempId,
    maskSource: "bbox",
    polygons: [],
    refinedBox: candidate.roughBox,
  };
}

export async function embedScene(input: EmbedSceneInput): Promise<EmbedResult> {
  const fetcher = input.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(providerUrl(input.baseUrl, "/sam2/embed_image", input.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: { type: "base64", value: encodeBase64(input.image) },
        image_id: input.imageId,
        sam2_version_id: "hiera_tiny",
      }),
      signal: input.signal,
    });
  } catch (error) {
    throw new ProviderError(
      "ROBOFLOW_REQUEST_FAILED",
      "Roboflow could not be reached. The scan can continue with boxes.",
      { cause: error, retryable: true },
    );
  }

  if (!response.ok) throw providerHttpError("ROBOFLOW", response.status);

  try {
    const parsed = embedResponseSchema.parse(await response.json());
    return { imageId: parsed.image_id, providerTimeSeconds: parsed.time };
  } catch (error) {
    throw new ProviderError(
      "ROBOFLOW_INVALID_RESPONSE",
      "Roboflow returned invalid embedding data. The scan can continue with boxes.",
      { cause: error },
    );
  }
}

export async function segmentCandidates(
  input: SegmentCandidatesInput,
): Promise<SegmentationResult> {
  if (input.candidates.length === 0) {
    return { items: [], polygonCount: 0, fallbackCount: 0 };
  }

  const fetcher = input.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(providerUrl(input.baseUrl, "/sam2/segment_image", input.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: { type: "base64", value: encodeBase64(input.image) },
        image_id: input.imageId,
        prompts: {
          prompts: input.candidates.map(({ roughBox }) => ({
            box: pixelBoxToRoboflowBox(roughBox),
          })),
        },
        sam2_version_id: "hiera_tiny",
        multimask_output: false,
        format: "json",
      }),
      signal: input.signal,
    });
  } catch (error) {
    throw new ProviderError(
      "ROBOFLOW_REQUEST_FAILED",
      "Roboflow could not be reached. The scan can continue with boxes.",
      { cause: error, retryable: true },
    );
  }

  if (!response.ok) throw providerHttpError("ROBOFLOW", response.status);

  let envelope: z.infer<typeof segmentationEnvelopeSchema>;
  try {
    envelope = segmentationEnvelopeSchema.parse(await response.json());
  } catch (error) {
    throw new ProviderError(
      "ROBOFLOW_INVALID_RESPONSE",
      "Roboflow returned invalid mask data. The scan can continue with boxes.",
      { cause: error },
    );
  }

  const imageArea = input.width * input.height;
  const acceptedBounds: PixelBox[] = [];
  const items = input.candidates.map((candidate, index): SegmentationItem => {
    const parsed = predictionSchema.safeParse(envelope.predictions[index]);
    if (!parsed.success || parsed.data.confidence < 0.5) return fallback(candidate);

    const polygons = capPolygons(
      parsed.data.masks
        .map((polygon) => normalizeContour(polygon, input.width, input.height))
        .filter((polygon) => polygon.length >= 3)
        .filter((polygon) => polygonArea(polygon) >= imageArea * 0.0003),
    );
    const totalArea = polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
    if (polygons.length === 0 || totalArea < imageArea * 0.001 || totalArea > imageArea * 0.7) {
      return fallback(candidate);
    }

    const refinedBox = boundsFor(polygons);
    if (
      !boxesIntersect(refinedBox, candidate.roughBox) ||
      !centroidInsideExpandedBox(polygons, candidate.roughBox) ||
      acceptedBounds.some((box) => boxIou(box, refinedBox) >= 0.85)
    ) {
      return fallback(candidate);
    }

    acceptedBounds.push(refinedBox);
    return {
      tempId: candidate.tempId,
      maskSource: "roboflow_sam2",
      polygons,
      refinedBox,
      confidence: parsed.data.confidence,
    };
  });

  return {
    items,
    polygonCount: items.reduce((sum, item) => sum + item.polygons.length, 0),
    fallbackCount: items.filter(({ maskSource }) => maskSource === "bbox").length,
    ...(envelope.time === undefined ? {} : { providerTimeSeconds: envelope.time }),
  };
}
