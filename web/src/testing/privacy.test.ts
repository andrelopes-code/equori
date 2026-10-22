import { describe, expect, it } from "vitest";

import { expectNoAmounts } from "@/testing/privacy";

function html(markup: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = markup;
  return container;
}

describe("expectNoAmounts", () => {
  it("fails on a formatted amount in text", () => {
    expect(() => {
      expectNoAmounts(html("<span>R$ 1.234,56</span>"), []);
    }).toThrow(/1\.234,56/);
  });

  it("fails on a formatted amount in an attribute", () => {
    expect(() => {
      expectNoAmounts(html('<span aria-label="R$ 1.234,56">x</span>'), []);
    }).toThrow(/1\.234,56/);
  });

  it("fails on a known string", () => {
    expect(() => {
      expectNoAmounts(html("<span>sete mil</span>"), ["sete mil"]);
    }).toThrow(/sete mil/);
  });

  it("passes on the coordinates of a drawing", () => {
    expect(() => {
      expectNoAmounts(
        html('<svg><path d="M10.50 3.25 4.75 4.00"></path></svg>'),
        [],
      );
    }).not.toThrow();
  });

  it("passes on masks, dates and datetime attributes", () => {
    expect(() => {
      expectNoAmounts(
        html(
          '<span>R$ ••••</span><span>21/10/2026</span><time datetime="2026-10-21T10:00:00.00Z">x</time>',
        ),
        [],
      );
    }).not.toThrow();
  });
});
