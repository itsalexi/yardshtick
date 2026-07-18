/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CapturePage from "./page";

const createDraft = vi.fn();
const startScan = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/src/services/yard-service", () => ({
  getYardService: () => ({ createDraft, startScan }),
}));

describe("CapturePage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    createDraft.mockReset();
    startScan.mockReset();
    push.mockReset();
    createDraft.mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 2048, height: 1536, close: vi.fn() }),
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:scene-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows the selected photo while its upload is still pending", async () => {
    await act(async () => root.render(<CapturePage />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["scene"], "scene.jpg", { type: "image/jpeg" });

    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input?.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('img[alt="Selected scene preview"]')).not.toBeNull();
    expect(container.textContent).toContain("Uploading your photo");
  });

  it("keeps the preview and offers recovery when upload fails", async () => {
    createDraft.mockRejectedValueOnce(new Error("Upload interrupted"));
    await act(async () => root.render(<CapturePage />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["scene"], "scene.jpg", { type: "image/jpeg" });

    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input?.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('img[alt="Selected scene preview"]')).not.toBeNull();
    expect(container.textContent).toContain("Upload interrupted");
    expect(container.textContent).toContain("Retry upload");
    expect(container.textContent).toContain("Choose another");
  });
});
