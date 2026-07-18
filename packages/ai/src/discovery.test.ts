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
        input: Array<{
          role: string;
          content: Array<{ type: string; text?: string }>;
        }>;
        text: {
          format: {
            type: string;
            strict: boolean;
            schema: {
              properties: {
                candidates: {
                  items: {
                    required: string[];
                    properties: { visibility: { enum: string[] } };
                  };
                };
              };
            };
          };
        };
      };
      expect(request.model).toBe("gpt-5.6-sol");
      expect(request.reasoning).toEqual({ effort: "low" });
      expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
      expect(
        request.text.format.schema.properties.candidates.items.required,
      ).toContain("visibility");
      expect(
        request.text.format.schema.properties.candidates.items.properties.visibility.enum,
      ).toEqual(["clear", "usable_partial", "insufficient"]);
      expect(request.input[0]?.role).toBe("developer");
      expect(request.input[0]?.content[0]?.text).toContain(
        "Find every distinct visible physical object",
      );
      expect(request.input[0]?.content[0]?.text).toContain(
        "background objects are eligible",
      );
      expect(request.input[0]?.content[0]?.text).toContain(
        "Exclude people, body parts, architecture",
      );
      expect(request.input[0]?.content[0]?.text).toContain(
        "credible marketplace listing image",
      );

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

  it("keeps identifiable furniture from a wider room scene", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify(
          openAiResponse([
            {
              tempId: "table",
              displayName: "White Table",
              category: "Furniture",
              sellabilityConfidence: 0.99,
              visibility: "clear",
              box: { xMin: 100, yMin: 100, xMax: 900, yMax: 900 },
            },
          ]),
        ),
        { status: 200 },
      ),
    );

    const result = await discoverProducts({
      apiKey: "test-key",
      image: new Uint8Array([1]),
      mimeType: "image/jpeg",
      width: 2048,
      height: 1536,
      fetcher,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.displayName).toBe("White Table");
  });

  it("keeps imageable partial items and rejects candidates without enough visual context", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify(
          openAiResponse([
            {
              tempId: "chair",
              displayName: "Dining Chair",
              category: "Furniture",
              sellabilityConfidence: 0.9,
              visibility: "clear",
              box: { xMin: 50, yMin: 50, xMax: 350, yMax: 650 },
            },
            {
              tempId: "cap",
              displayName: "Baseball Cap",
              category: "Clothing",
              sellabilityConfidence: 0.88,
              visibility: "usable_partial",
              box: { xMin: 400, yMin: 400, xMax: 700, yMax: 700 },
            },
            {
              tempId: "edge-lamp",
              displayName: "Floor Lamp",
              category: "Lighting",
              sellabilityConfidence: 0.86,
              visibility: "usable_partial",
              box: { xMin: 0, yMin: 100, xMax: 120, yMax: 800 },
            },
            {
              tempId: "hidden-table",
              displayName: "Occluded Table",
              category: "Furniture",
              sellabilityConfidence: 0.99,
              visibility: "insufficient",
              box: { xMin: 100, yMin: 100, xMax: 900, yMax: 900 },
            },
            {
              tempId: "sliver",
              displayName: "Thin Fragment",
              category: "Other",
              sellabilityConfidence: 0.99,
              visibility: "clear",
              box: { xMin: 800, yMin: 100, xMax: 820, yMax: 900 },
            },
            {
              tempId: "tiny",
              displayName: "Tiny Object",
              category: "Other",
              sellabilityConfidence: 0.99,
              visibility: "clear",
              box: { xMin: 720, yMin: 720, xMax: 750, yMax: 750 },
            },
            {
              tempId: "legacy-area-floor",
              displayName: "Small but Resolved Object",
              category: "Other",
              sellabilityConfidence: 0.99,
              visibility: "clear",
              box: { xMin: 750, yMin: 700, xMax: 785, yMax: 750 },
            },
            {
              tempId: "area-boundary",
              displayName: "Boundary Object",
              category: "Other",
              sellabilityConfidence: 0.8,
              visibility: "clear",
              box: { xMin: 850, yMin: 700, xMax: 890, yMax: 750 },
            },
          ]),
        ),
        { status: 200 },
      ),
    );

    const result = await discoverProducts({
      apiKey: "test-key",
      image: new Uint8Array([1]),
      mimeType: "image/jpeg",
      width: 2048,
      height: 1536,
      fetcher,
    });

    expect(result.candidates.map(({ tempId }) => tempId)).toEqual([
      "chair",
      "cap",
      "edge-lamp",
      "area-boundary",
    ]);
    expect(result.candidates[0]).not.toHaveProperty("visibility");
  });

  it("rejects provider candidates that omit the visibility judgment", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify(
          openAiResponse([
            {
              tempId: "unknown",
              displayName: "Unknown Object",
              category: "Other",
              sellabilityConfidence: 0.9,
              box: { xMin: 100, yMin: 100, xMax: 500, yMax: 500 },
            },
          ]),
        ),
        { status: 200 },
      ),
    );

    await expect(
      discoverProducts({
        apiKey: "test-key",
        image: new Uint8Array([1]),
        mimeType: "image/jpeg",
        width: 2000,
        height: 1000,
        fetcher,
      }),
    ).rejects.toMatchObject({ code: "OPENAI_INVALID_RESPONSE" });
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
