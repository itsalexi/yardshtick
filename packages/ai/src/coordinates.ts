import type { PixelBox } from "@yard/contracts";

export type NormalizedBox = {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

export type RoboflowBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizedBoxToPixels(
  box: NormalizedBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  return {
    x1: Math.round((box.xMin / 1000) * imageWidth),
    y1: Math.round((box.yMin / 1000) * imageHeight),
    x2: Math.round((box.xMax / 1000) * imageWidth),
    y2: Math.round((box.yMax / 1000) * imageHeight),
  };
}

export function pixelBoxToRoboflowBox(box: PixelBox): RoboflowBox {
  return {
    x: (box.x1 + box.x2) / 2,
    y: (box.y1 + box.y2) / 2,
    width: box.x2 - box.x1,
    height: box.y2 - box.y1,
  };
}
