import type { PixelBox, PixelPoint, ScanItem } from "@yard/contracts";

type ImageSize = { width: number; height: number };

export type GeneratedCrop = {
  blob: Blob;
  mimeType: "image/webp" | "image/png" | "image/jpeg";
  maskRevision: number;
};

function polygonBounds(polygons: PixelPoint[][]): PixelBox | null {
  const points = polygons.flat();
  if (points.length === 0) return null;
  return {
    x1: Math.min(...points.map(([x]) => x)),
    y1: Math.min(...points.map(([, y]) => y)),
    x2: Math.max(...points.map(([x]) => x)),
    y2: Math.max(...points.map(([, y]) => y)),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function cropBounds(item: ScanItem, image: ImageSize): PixelBox {
  const source = polygonBounds(item.polygons) ?? item.refinedBox ?? item.roughBox;
  const paddingX = (source.x2 - source.x1) * 0.06;
  const paddingY = (source.y2 - source.y1) * 0.06;
  return {
    x1: clamp(source.x1 - paddingX, 0, image.width),
    y1: clamp(source.y1 - paddingY, 0, image.height),
    x2: clamp(source.x2 + paddingX, 0, image.width),
    y2: clamp(source.y2 + paddingY, 0, image.height),
  };
}

function outputSize(bounds: PixelBox): ImageSize {
  const width = bounds.x2 - bounds.x1;
  const height = bounds.y2 - bounds.y1;
  const scale = Math.min(1, 640 / width, 640 / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function cropPoint(
  [x, y]: PixelPoint,
  bounds: PixelBox,
  output: ImageSize,
): PixelPoint {
  return [
    ((x - bounds.x1) / (bounds.x2 - bounds.x1)) * output.width,
    ((y - bounds.y1) / (bounds.y2 - bounds.y1)) * output.height,
  ];
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/png" | "image/jpeg",
  quality?: number,
) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(canvas: HTMLCanvasElement, transparent: boolean) {
  const webp = await canvasBlob(canvas, "image/webp", 0.9);
  if (webp?.type === "image/webp") {
    return { blob: webp, mimeType: "image/webp" as const };
  }
  const mimeType: "image/png" | "image/jpeg" = transparent
    ? "image/png"
    : "image/jpeg";
  const blob = await canvasBlob(canvas, mimeType, transparent ? undefined : 0.9);
  if (!blob || blob.type !== mimeType) {
    throw new Error("This browser could not encode the item crop.");
  }
  return { blob, mimeType };
}

function mask(
  context: CanvasRenderingContext2D,
  polygons: PixelPoint[][],
  bounds: PixelBox,
  output: ImageSize,
) {
  context.globalCompositeOperation = "destination-in";
  context.beginPath();
  for (const polygon of polygons) {
    if (polygon.length < 3) continue;
    const [first, ...rest] = polygon;
    const [startX, startY] = cropPoint(first, bounds, output);
    context.moveTo(startX, startY);
    for (const point of rest) {
      const [x, y] = cropPoint(point, bounds, output);
      context.lineTo(x, y);
    }
    context.closePath();
  }
  context.fill();
  context.globalCompositeOperation = "source-over";
}

export async function generateItemCrop(input: {
  imageUrl: string;
  imageSize: ImageSize;
  item: ScanItem;
}): Promise<GeneratedCrop> {
  const bounds = cropBounds(input.item, input.imageSize);
  const output = outputSize(bounds);
  const transparent = input.item.polygons.some((polygon) => polygon.length >= 3);
  const response = await fetch(input.imageUrl);
  if (!response.ok) throw new Error("Could not load the sale photo.");

  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This browser could not create the item crop.");
  }

  try {
    if (!transparent) {
      context.fillStyle = "#f3f1eb";
      context.fillRect(0, 0, output.width, output.height);
    }
    context.drawImage(
      bitmap,
      bounds.x1,
      bounds.y1,
      bounds.x2 - bounds.x1,
      bounds.y2 - bounds.y1,
      0,
      0,
      output.width,
      output.height,
    );
    if (transparent) mask(context, input.item.polygons, bounds, output);
    return { ...(await encode(canvas, transparent)), maskRevision: input.item.maskRevision };
  } finally {
    bitmap.close();
  }
}
