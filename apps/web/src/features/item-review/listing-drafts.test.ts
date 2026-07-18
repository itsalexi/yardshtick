import { demoSale } from "@yard/mock-data";
import { describe, expect, it } from "vitest";

import {
  applyListingDrafts,
  rememberListingDraft,
  rememberSelectionDraft,
} from "./listing-drafts";

describe("listing drafts", () => {
  it("keeps local form edits when a polling response arrives", () => {
    const item = demoSale.items[0];
    const drafts = rememberListingDraft({}, item.id, {
      title: "My edited camera title",
      condition: "fair",
    });
    const remote = {
      ...structuredClone(demoSale),
      progress: 90,
      items: demoSale.items.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, imageUrl: "https://example.com/new-product-photo.webp" }
          : candidate,
      ),
    };

    const merged = applyListingDrafts(remote, drafts);
    const mergedItem = merged.items.find((candidate) => candidate.id === item.id);

    expect(merged.progress).toBe(90);
    expect(mergedItem).toMatchObject({
      title: "My edited camera title",
      condition: "fair",
      imageUrl: "https://example.com/new-product-photo.webp",
    });
  });

  it("preserves an intentionally cleared price across polling", () => {
    const item = demoSale.items[0];
    const drafts = rememberListingDraft({}, item.id, { finalPricePhp: undefined });
    const merged = applyListingDrafts(structuredClone(demoSale), drafts);
    const mergedItem = merged.items.find((candidate) => candidate.id === item.id);

    expect(mergedItem).toHaveProperty("finalPricePhp", undefined);
  });

  it("keeps a local selection when a stale polling response arrives", () => {
    const item = demoSale.items[0];
    const drafts = rememberSelectionDraft({}, item.id, false);
    const merged = applyListingDrafts(structuredClone(demoSale), drafts);

    expect(merged.items.find((candidate) => candidate.id === item.id)?.selected).toBe(
      false,
    );
  });
});
