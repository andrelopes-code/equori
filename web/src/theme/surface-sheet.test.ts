import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { surfaceSheet } from "@/theme/surface-sheet";

describe("surface sheet", () => {
  const css = surfaceSheet();

  it("paints an oled ground black in the dark scheme", () => {
    const rule = ruleFor(
      css,
      '[data-equori-depth="oled"][data-equori-step="standard"][data-slotted-scheme="dark"]',
    );

    expect(rule).toContain(
      "--slotted-surface: oklch(from var(--slotted-seed-neutral) 0 min(calc(c * 0.22), 0.08) h);",
    );
  });

  it("reaches a scheme scope under the element that carries the value", () => {
    expect(css).toContain(
      '[data-equori-shadows="flat"] [data-slotted-scheme="light"]:not([data-equori-shadows])',
    );
  });

  it("matches the sheet make gen wrote", () => {
    expect(readFileSync("src/theme/surface.gen.css", "utf8")).toBe(`${css}\n`);
  });

  it("leaves the high-contrast scheme to the compiled theme", () => {
    expect(css).not.toContain("high-contrast");
  });

  it("writes a shadow as its CSS value", () => {
    const rule = ruleFor(
      css,
      '[data-equori-shadows="flat"][data-slotted-scheme="dark"]',
    );

    expect(rule).toContain("--slotted-shadow-md: none;");
  });
});

function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`no rule for ${selector}`);

  return css.slice(start, css.indexOf("}", start));
}
