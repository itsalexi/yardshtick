import { describe, expect, it } from "vitest";

import { canonicalBoxToDisplay, polygonToSvgPoints } from "./geometry";

describe("lab geometry", () => {
  it("scales canonical coordinates into a fitted display", () => {
    expect(
      canonicalBoxToDisplay(
        { x1: 100, y1: 200, x2: 500, y2: 600 },
        { width: 1000, height: 800 },
        { width: 500, height: 400 },
      ),
    ).toEqual({ x1: 50, y1: 100, x2: 250, y2: 300 });
  });

  it("serializes a polygon without changing point order", () => {
    expect(
      polygonToSvgPoints([
        [1, 2],
        [3, 4],
        [5, 6],
      ]),
    ).toBe("1,2 3,4 5,6");
  });
});
