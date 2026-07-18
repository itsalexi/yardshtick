import { demoSale } from "@yard/mock-data";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ItemChecklist } from "./item-checklist";

describe("ItemChecklist", () => {
  it("renders every detected item as a separate checklist target", () => {
    const items = demoSale.items
      .slice(0, 2)
      .map((item) => ({ ...item, selected: false }));
    const html = renderToStaticMarkup(
      createElement(ItemChecklist, { items, onToggle: vi.fn() }),
    );

    expect(html).toContain("Select items");
    expect(html).toContain("Fujifilm Instax Mini 12");
    expect(html).toContain("JBL Flip 6 Speaker");
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
  });
});
