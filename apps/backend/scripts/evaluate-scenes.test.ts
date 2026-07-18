import { describe, expect, it } from "vitest";

import {
  matchesRequiredLabel,
  summarizeSceneEvaluation,
} from "./evaluate-scenes";

describe("matchesRequiredLabel", () => {
  it("matches semantic aliases case-insensitively", () => {
    expect(
      matchesRequiredLabel("Apple Smartphone", ["phone", "smartphone"]),
    ).toBe(true);
    expect(
      matchesRequiredLabel("Wooden Table", ["phone", "smartphone"]),
    ).toBe(false);
  });

  it("treats punctuation and word order as non-semantic", () => {
    expect(
      matchesRequiredLabel("USB-C Power Adapter + Cable", [
        "power adapter and cable",
      ]),
    ).toBe(true);
  });
});

describe("summarizeSceneEvaluation", () => {
  it("records recall and safe terminal diagnostics without provider payloads", () => {
    const summary = summarizeSceneEvaluation(
      {
        fixtureKey: "fixture-one",
        expectedCandidateRange: [1, 2],
        required: [
          { label: "smartphone", aliases: ["phone", "smartphone"] },
        ],
        optional: [],
        excluded: ["table"],
      },
      {
        status: "ready",
        error: null,
        run: {
          candidateCount: 2,
          polygonCount: 1,
          fallbackCount: 1,
          discoveryMs: 100,
          segmentationMs: 200,
          totalMs: 350,
        },
        items: [{ title: "Apple Smartphone" }, { title: "Wooden Table" }],
      },
    );

    expect(summary).toMatchObject({
      fixtureKey: "fixture-one",
      terminalStatus: "ready",
      candidateCount: 2,
      polygonCount: 1,
      fallbackCount: 1,
      requiredFound: 1,
      requiredTotal: 1,
      requiredRecall: 1,
      unexpectedCount: 1,
      errorCode: null,
    });
    expect(JSON.stringify(summary)).not.toContain("Apple Smartphone");
  });
});
