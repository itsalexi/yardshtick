import { describe, expect, it, vi } from "vitest";

import { generateMarketplaceImage as exportedGenerateMarketplaceImage } from "./index";
import { generateMarketplaceImage } from "./marketplace-image";

describe("generateMarketplaceImage", () => {
  it("is available from the package entry point", () => {
    expect(exportedGenerateMarketplaceImage).toBe(generateMarketplaceImage);
  });

  it("sends one crop to GPT Image 2 and decodes the returned JPEG", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x2b]);
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.openai.com/v1/images/edits");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ Authorization: "Bearer test-key" });
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      const form = init?.body;
      expect(form).toBeInstanceOf(FormData);
      if (!(form instanceof FormData)) throw new Error("Expected multipart form data");

      expect(form.get("model")).toBe("gpt-image-2");
      expect(form.get("n")).toBe("1");
      expect(form.get("size")).toBe("1024x1024");
      expect(form.get("quality")).toBe("low");
      expect(form.get("background")).toBe("opaque");
      expect(form.get("output_format")).toBe("jpeg");
      expect(form.has("input_fidelity")).toBe(false);

      const prompt = form.get("prompt");
      expect(prompt).toEqual(expect.any(String));
      expect(String(prompt)).toContain("exact item");
      expect(String(prompt)).toContain("Preserve");
      expect(String(prompt)).toContain("Do not add props");

      const images = form.getAll("image[]");
      expect(images).toHaveLength(1);
      expect(images[0]).toBeInstanceOf(Blob);
      expect((images[0] as Blob).type).toBe("image/webp");
      expect(new Uint8Array(await (images[0] as Blob).arrayBuffer())).toEqual(
        new Uint8Array([1, 2, 3]),
      );

      return new Response(
        JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(...jpeg)) }] }),
        { status: 200 },
      );
    });
    const signal = AbortSignal.timeout(1_000);

    const result = await generateMarketplaceImage({
      apiKey: "test-key",
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/webp",
      fetcher,
      signal,
    });

    expect(result).toEqual(jpeg);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("normalizes network failures without exposing their cause", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("Bearer sk-private");
    });

    const promise = generateMarketplaceImage({
      apiKey: "test-key",
      image: new Uint8Array([1]),
      mimeType: "image/jpeg",
      fetcher,
    });

    await expect(promise).rejects.toMatchObject({
      code: "OPENAI_REQUEST_FAILED",
      message: "OpenAI could not be reached. Try again.",
      retryable: true,
    });
    await expect(promise).rejects.not.toThrow(/sk-private/);
  });

  it.each([
    [429, "OPENAI_RATE_LIMITED", true],
    [503, "OPENAI_UNAVAILABLE", true],
    [400, "OPENAI_REJECTED", false],
  ] as const)(
    "normalizes an HTTP %s response without reading its body",
    async (status, code, retryable) => {
      const response = new Response("Bearer sk-private", { status });
      const readBody = vi.spyOn(response, "json");
      const fetcher = vi.fn(async () => response);

      const promise = generateMarketplaceImage({
        apiKey: "test-key",
        image: new Uint8Array([1]),
        mimeType: "image/jpeg",
        fetcher,
      });

      await expect(promise).rejects.toMatchObject({ code, retryable, status });
      await expect(promise).rejects.not.toThrow(/sk-private/);
      expect(readBody).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["invalid JSON", "not-json"],
    ["missing image data", JSON.stringify({ data: [] })],
    ["invalid base64", JSON.stringify({ data: [{ b64_json: "not@@base64" }] })],
    [
      "non-JPEG bytes",
      JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(1, 2, 3)) }] }),
    ],
  ])("normalizes a malformed response with %s", async (_case, body) => {
    const fetcher = vi.fn(async () => new Response(body, { status: 200 }));

    await expect(
      generateMarketplaceImage({
        apiKey: "test-key",
        image: new Uint8Array([1]),
        mimeType: "image/png",
        fetcher,
      }),
    ).rejects.toMatchObject({
      code: "OPENAI_INVALID_RESPONSE",
      message: "OpenAI returned an invalid marketplace image. Try again.",
      retryable: false,
    });
  });
});
