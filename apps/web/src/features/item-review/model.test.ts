import { describe, expect, it } from "vitest";

import {
  createPhotoStates,
  markPhotoReady,
  moveReviewIndex,
  normalizeReviewIndex,
  replacePhoto,
  retryPhoto,
} from "./model";

describe("item review model", () => {
  it("keeps previous and next navigation inside the item list", () => {
    expect(moveReviewIndex(0, -1, 6)).toBe(0);
    expect(moveReviewIndex(0, 1, 6)).toBe(1);
    expect(moveReviewIndex(5, 1, 6)).toBe(5);
  });

  it("starts every generated photo in the loading state", () => {
    const states = createPhotoStates(["item_camera", "item_speaker"]);

    expect(states.item_camera).toEqual({
      status: "generating",
      source: "generated",
      revision: 0,
    });
    expect(states.item_speaker.status).toBe("generating");
  });

  it("retries a generated photo with a new revision and loading state", () => {
    expect(retryPhoto({ status: "ready", source: "generated", revision: 0 })).toEqual({
      status: "generating",
      source: "generated",
      revision: 1,
    });
  });

  it("marks the current generated photo ready without changing its revision", () => {
    expect(markPhotoReady({ status: "generating", source: "generated", revision: 2 })).toEqual({
      status: "ready",
      source: "generated",
      revision: 2,
    });
  });

  it("replaces generation with an uploaded preview", () => {
    expect(
      replacePhoto(
        { status: "generating", source: "generated", revision: 0 },
        "blob:test",
      ),
    ).toEqual({
      status: "ready",
      source: "upload",
      revision: 0,
      previewUrl: "blob:test",
    });
  });

  it("clamps the active review when the selected list shrinks", () => {
    expect(normalizeReviewIndex(5, 5)).toBe(4);
    expect(normalizeReviewIndex(0, 0)).toBe(0);
  });
});
