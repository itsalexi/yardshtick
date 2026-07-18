import { describe, expect, it } from "vitest";

import { normalizedBoxToPixels, pixelBoxToRoboflowBox } from "./coordinates";

describe("coordinate conversion", () => {
  it("converts normalized GPT coordinates to canonical pixels", () => {
    expect(
      normalizedBoxToPixels(
        { xMin: 250, yMin: 100, xMax: 750, yMax: 900 },
        2000,
        1000,
      ),
    ).toEqual({ x1: 500, y1: 100, x2: 1500, y2: 900 });
  });

  it("converts a pixel box to Roboflow's center-based box", () => {
    expect(pixelBoxToRoboflowBox({ x1: 100, y1: 200, x2: 500, y2: 600 })).toEqual({
      x: 300,
      y: 400,
      width: 400,
      height: 400,
    });
  });
});
