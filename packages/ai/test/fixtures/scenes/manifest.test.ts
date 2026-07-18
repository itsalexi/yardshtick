import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { sceneManifest } from "./manifest";

describe("sceneManifest", () => {
  it("describes six unique scene fixtures", () => {
    expect(sceneManifest).toHaveLength(6);
    expect(new Set(sceneManifest.map(({ fixtureKey }) => fixtureKey)).size).toBe(6);
  });

  it("points to canonical 2048x1536 images", async () => {
    for (const scene of sceneManifest) {
      const path = fileURLToPath(new URL(scene.fileName, import.meta.url));

      await expect(access(path)).resolves.toBeUndefined();
      const metadata = await sharp(path).metadata();
      expect([metadata.width, metadata.height]).toEqual([scene.width, scene.height]);
    }
  });

  it("uses valid ranges and disjoint included and excluded aliases", () => {
    for (const scene of sceneManifest) {
      expect(scene.expectedCandidateRange[0]).toBeLessThanOrEqual(
        scene.expectedCandidateRange[1],
      );
      const included = [...scene.required, ...scene.optional].flatMap(({ aliases }) => aliases);
      const excluded = new Set<string>(scene.excluded);
      expect(included.filter((label) => excluded.has(label))).toEqual([]);
    }
  });

  it("treats visible room furniture as garage-sale inventory", () => {
    const room = sceneManifest.find(
      ({ fixtureKey }) => fixtureKey === "empty-table-room",
    );

    expect(room?.expectedCandidateRange[0]).toBeGreaterThan(0);
    expect(room?.required.map(({ label }) => label)).toEqual(
      expect.arrayContaining(["table", "chair"]),
    );
  });
});
