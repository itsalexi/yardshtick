import { demoSale } from "@yard/mock-data";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SceneView } from "./scene-view";

describe("SceneView", () => {
  it("uses exclamation markers instead of visible item labels", () => {
    const item = demoSale.items[0];
    const html = renderToStaticMarkup(createElement(SceneView, { items: [item] }));

    expect(html).toContain('class="box-marker"');
    expect(html).toContain(">!</span>");
    expect(html).not.toContain('class="box-label"');
    expect(html).toContain(`aria-label="${item.title}"`);
  });
});
