import { describe, expect, it } from "vitest";

import {
  canonicalPointToCrop,
  getCropBounds,
  getCropOutputSize,
} from "./crop";

describe("browser crop geometry", () => {
  it("uses the polygon bounds and adds six percent padding", () => {
    expect(
      getCropBounds(
        {
          polygons: [
            [
              [100, 100],
              [300, 100],
              [300, 200],
              [100, 200],
            ],
          ],
          refinedBox: { x1: 40, y1: 50, x2: 400, y2: 300 },
          roughBox: { x1: 20, y1: 30, x2: 500, y2: 400 },
        },
        { width: 1_000, height: 800 },
      ),
    ).toEqual({ x1: 88, y1: 94, x2: 312, y2: 206 });
  });

  it("falls back to the refined box and then the rough box", () => {
    expect(
      getCropBounds(
        {
          polygons: [],
          refinedBox: { x1: 20, y1: 30, x2: 100, y2: 90 },
          roughBox: { x1: 5, y1: 10, x2: 120, y2: 110 },
        },
        { width: 200, height: 150 },
      ),
    ).toEqual({ x1: 15.2, y1: 26.4, x2: 104.8, y2: 93.6 });

    expect(
      getCropBounds(
        {
          polygons: [],
          refinedBox: null,
          roughBox: { x1: 50, y1: 20, x2: 150, y2: 120 },
        },
        { width: 200, height: 150 },
      ),
    ).toEqual({ x1: 44, y1: 14, x2: 156, y2: 126 });
  });

  it("clamps padded bounds to the canonical image", () => {
    expect(
      getCropBounds(
        {
          polygons: [
            [
              [0, 10],
              [100, 10],
              [100, 60],
              [0, 60],
            ],
          ],
          refinedBox: null,
          roughBox: { x1: 0, y1: 10, x2: 100, y2: 60 },
        },
        { width: 100, height: 60 },
      ),
    ).toEqual({ x1: 0, y1: 7, x2: 100, y2: 60 });
  });

  it("scales large crops to fit within 640 pixels without upscaling", () => {
    expect(getCropOutputSize({ x1: 0, y1: 0, x2: 1_280, y2: 640 })).toEqual({
      width: 640,
      height: 320,
    });
    expect(getCropOutputSize({ x1: 0, y1: 0, x2: 320, y2: 240 })).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("transforms canonical polygon points into crop output coordinates", () => {
    const bounds = { x1: 100, y1: 50, x2: 500, y2: 250 };
    const output = { width: 640, height: 320 };

    expect(canonicalPointToCrop([100, 50], bounds, output)).toEqual([0, 0]);
    expect(canonicalPointToCrop([300, 150], bounds, output)).toEqual([320, 160]);
    expect(canonicalPointToCrop([500, 250], bounds, output)).toEqual([640, 320]);
  });
});
