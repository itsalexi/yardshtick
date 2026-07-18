import { describe, expect, it, vi } from "vitest";

import discoverySuccess from "../test/fixtures/providers/openai-discovery-success.json";
import { discoverProducts } from "./discovery";

function openAiResponse(candidates: unknown[]) {
  return {
    id: "resp_1",
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ candidates }),
          },
        ],
      },
    ],
  };
}

describe("discoverProducts", () => {
  it("converts valid normalized boxes and removes weak and duplicate candidates", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        model: string;
        reasoning: { effort: string };
        text: { format: { type: string; strict: boolean } };
      };
      expect(request.model).toBe("gpt-5.6-sol");
      expect(request.reasoning).toEqual({ effort: "low" });
      expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });

      return new Response(JSON.stringify(discoverySuccess), { status: 200 });
    });

    const result = await discoverProducts({
      apiKey: "test-key",
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
      width: 2000,
      height: 1000,
      fetcher,
    });

    expect(result).toEqual({
      responseId: "resp_1",
      candidates: [
        {
          tempId: "phone",
          displayName: "Smartphone",
          category: "Electronics",
          sellabilityConfidence: 0.92,
          roughBox: { x1: 200, y1: 100, x2: 1000, y2: 900 },
        },
      ],
    });
  });

  it("returns an empty candidate list from a valid empty response", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(openAiResponse([])), { status: 200 }),
    );

    const result = await discoverProducts({
      apiKey: "test-key",
      image: new Uint8Array([1]),
      mimeType: "image/jpeg",
      width: 2048,
      height: 1536,
      fetcher,
    });

    expect(result.candidates).toEqual([]);
  });

  it("normalizes rate limits without reading the provider body into the error", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Bearer sk-private" }), { status: 429 }),
    );

    await expect(
      discoverProducts({
        apiKey: "test-key",
        image: new Uint8Array([1]),
        mimeType: "image/jpeg",
        width: 2048,
        height: 1536,
        fetcher,
      }),
    ).rejects.toMatchObject({
      code: "OPENAI_RATE_LIMITED",
      retryable: true,
      status: 429,
    });
  });
});
