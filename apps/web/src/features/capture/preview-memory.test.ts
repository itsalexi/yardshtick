import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCapturePreview,
  releaseCapturePreview,
  rememberCapturePreview,
} from "./preview-memory";

describe("capture preview memory", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("carries the local photo preview into the analysis route", () => {
    rememberCapturePreview("sale-123", "blob:scene-preview");

    expect(getCapturePreview("sale-123")).toBe("blob:scene-preview");
  });

  it("revokes the local preview once the canonical image is ready", () => {
    rememberCapturePreview("sale-456", "blob:scene-preview-2");

    releaseCapturePreview("sale-456");

    expect(getCapturePreview("sale-456")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:scene-preview-2");
  });
});
