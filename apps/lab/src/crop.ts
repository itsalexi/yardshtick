import type { PixelBox, PixelPoint, ScanItem } from "@yard/contracts";

export type ImageSize = {
  width: number;
  height: number;
};

export type CropGeometry = Pick<ScanItem, "polygons" | "refinedBox" | "roughBox">;

export type GeneratedCrop = {
  blob: Blob;
  mimeType: "image/webp" | "image/png" | "image/jpeg";
  width: number;
  height: number;
  maskRevision: number;
};

export type GenerateItemCropInput = {
  imageUrl: string;
  imageSize: ImageSize;
  item: ScanItem;
  maxOutputSize?: number;
};

const DEFAULT_PADDING_RATIO = 0.06;
const DEFAULT_MAX_OUTPUT_SIZE = 640;

function polygonBounds(polygons: PixelPoint[][]): PixelBox | null {
  const points = polygons.flat();
  if (points.length === 0) {
    return null;
  }

  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
  }

  return { x1, y1, x2, y2 };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getCropBounds(
  item: CropGeometry,
  imageSize: ImageSize,
  paddingRatio = DEFAULT_PADDING_RATIO,
): PixelBox {
  const source = polygonBounds(item.polygons) ?? item.refinedBox ?? item.roughBox;
  const paddingX = (source.x2 - source.x1) * paddingRatio;
  const paddingY = (source.y2 - source.y1) * paddingRatio;

  return {
    x1: clamp(source.x1 - paddingX, 0, imageSize.width),
    y1: clamp(source.y1 - paddingY, 0, imageSize.height),
    x2: clamp(source.x2 + paddingX, 0, imageSize.width),
    y2: clamp(source.y2 + paddingY, 0, imageSize.height),
  };
}

export function getCropOutputSize(
  bounds: PixelBox,
  maxOutputSize = DEFAULT_MAX_OUTPUT_SIZE,
): ImageSize {
  const cropWidth = bounds.x2 - bounds.x1;
  const cropHeight = bounds.y2 - bounds.y1;
  const limit = Math.max(1, Math.floor(maxOutputSize));
  const scale = Math.min(1, limit / cropWidth, limit / cropHeight);

  return {
    width: Math.max(1, Math.round(cropWidth * scale)),
    height: Math.max(1, Math.round(cropHeight * scale)),
  };
}

export function canonicalPointToCrop(
  [x, y]: PixelPoint,
  bounds: PixelBox,
  outputSize: ImageSize,
): PixelPoint {
  return [
    ((x - bounds.x1) / (bounds.x2 - bounds.x1)) * outputSize.width,
    ((y - bounds.y1) / (bounds.y2 - bounds.y1)) * outputSize.height,
  ];
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/png" | "image/jpeg",
  quality?: number,
) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  transparent: boolean,
): Promise<Pick<GeneratedCrop, "blob" | "mimeType">> {
  const webp = await canvasToBlob(canvas, "image/webp", 0.9);
  if (webp?.type === "image/webp") {
    return { blob: webp, mimeType: "image/webp" as const };
  }

  const fallbackType = transparent ? "image/png" : "image/jpeg";
  const fallback = await canvasToBlob(canvas, fallbackType, transparent ? undefined : 0.9);
  if (fallback?.type !== fallbackType) {
    throw new Error("This browser could not encode the item crop.");
  }

  return { blob: fallback, mimeType: fallbackType };
}

function applyPolygonMask(
  context: CanvasRenderingContext2D,
  polygons: PixelPoint[][],
  bounds: PixelBox,
  outputSize: ImageSize,
) {
  context.globalCompositeOperation = "destination-in";
  context.beginPath();

  for (const polygon of polygons) {
    if (polygon.length < 3) {
      continue;
    }

    const [firstPoint, ...remainingPoints] = polygon;
    const [startX, startY] = canonicalPointToCrop(firstPoint, bounds, outputSize);
    context.moveTo(startX, startY);

    for (const point of remainingPoints) {
      const [x, y] = canonicalPointToCrop(point, bounds, outputSize);
      context.lineTo(x, y);
    }

    context.closePath();
  }

  context.fill();
  context.globalCompositeOperation = "source-over";
}

export async function generateItemCrop({
  imageUrl,
  imageSize,
  item,
  maxOutputSize = DEFAULT_MAX_OUTPUT_SIZE,
}: GenerateItemCropInput): Promise<GeneratedCrop> {
  const bounds = getCropBounds(item, imageSize);
  const outputSize = getCropOutputSize(bounds, maxOutputSize);
  const hasPolygonMask = item.polygons.some((polygon) => polygon.length >= 3);
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Could not load the canonical image (${response.status}).`);
  }

  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = outputSize.width;
  canvas.height = outputSize.height;
  const context = canvas.getContext("2d");

  if (context === null) {
    bitmap.close();
    throw new Error("This browser could not create an item crop.");
  }

  try {
    if (!hasPolygonMask) {
      context.fillStyle = "#f3f1eb";
      context.fillRect(0, 0, outputSize.width, outputSize.height);
    }

    context.drawImage(
      bitmap,
      bounds.x1,
      bounds.y1,
      bounds.x2 - bounds.x1,
      bounds.y2 - bounds.y1,
      0,
      0,
      outputSize.width,
      outputSize.height,
    );

    if (hasPolygonMask) {
      applyPolygonMask(context, item.polygons, bounds, outputSize);
    }

    const encoded = await encodeCanvas(canvas, hasPolygonMask);
    return {
      ...encoded,
      width: outputSize.width,
      height: outputSize.height,
      maskRevision: item.maskRevision,
    };
  } finally {
    bitmap.close();
  }
}
