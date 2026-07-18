import { demoSale } from "@yard/mock-data";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ItemReview, type ItemReviewProps } from "./item-review";
import { createPhotoStates, markPhotoReady } from "./model";

function renderReview(overrides: Partial<ItemReviewProps> = {}) {
  const items = demoSale.items.slice(0, 2);
  const props: ItemReviewProps = {
    items,
    activeIndex: 0,
    photoStates: createPhotoStates(items.map((item) => item.id)),
    publishable: true,
    onRetryPhoto: vi.fn(),
    onUploadPhoto: vi.fn(),
    onPatch: vi.fn(),
    onRemove: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onPublish: vi.fn(),
    onBackToScene: vi.fn(),
    ...overrides,
  };

  return renderToStaticMarkup(createElement(ItemReview, props));
}

describe("ItemReview", () => {
  it("shows one active item with a product-photo generation skeleton", () => {
    const html = renderReview();

    expect(html).toContain("Fujifilm Instax Mini 12");
    expect(html).not.toContain("JBL Flip 6 Speaker");
    expect(html).toContain('aria-label="Generating product photo"');
    expect(html).not.toContain(">Publish<");
  });

  it("shows photo controls and next navigation after generation", () => {
    const items = demoSale.items.slice(0, 2);
    const states = createPhotoStates(items.map((item) => item.id));
    states[items[0].id] = markPhotoReady(states[items[0].id]);
    const html = renderReview({ items, photoStates: states });

    expect(html).toContain("Upload your own");
    expect(html).toContain(">Next<");
    expect(html).not.toContain(">Publish<");
  });

  it("only shows publish on the last item", () => {
    const items = demoSale.items.slice(0, 2);
    const states = createPhotoStates(items.map((item) => item.id));
    states[items[1].id] = markPhotoReady(states[items[1].id]);
    const html = renderReview({ items, activeIndex: 1, photoStates: states });

    expect(html).toContain("JBL Flip 6 Speaker");
    expect(html).not.toContain(">Next<");
    expect(html).toContain(">Publish<");
  });
});
