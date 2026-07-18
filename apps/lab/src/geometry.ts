import type { PixelBox, PixelPoint } from "@yard/contracts";

export type ImageSize = {
  width: number;
  height: number;
};

export function canonicalBoxToDisplay(
  box: PixelBox,
  canonical: ImageSize,
  display: ImageSize,
): PixelBox {
  const scaleX = display.width / canonical.width;
  const scaleY = display.height / canonical.height;
  return {
    x1: box.x1 * scaleX,
    y1: box.y1 * scaleY,
    x2: box.x2 * scaleX,
    y2: box.y2 * scaleY,
  };
}

export function polygonToSvgPoints(polygon: PixelPoint[]) {
  return polygon.map(([x, y]) => `${x},${y}`).join(" ");
}
