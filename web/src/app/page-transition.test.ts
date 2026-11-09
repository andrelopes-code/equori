import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { pageTransitionTypes } from "@/app/page-transition";

describe("pageTransitionTypes", () => {
  it("types a path change as a page transition", () => {
    expect(pageTransitionTypes({ pathChanged: true })).toEqual(["page"]);
  });

  it("skips the transition when only the search or hash changed", () => {
    expect(pageTransitionTypes({ pathChanged: false })).toBe(false);
  });
});

describe("the main region's view-transition-name", () => {
  const css = readFileSync("src/app/shell/app-frame.module.css", "utf8");

  // A named element is a backdrop root: the blur of a sticky header inside it stops working.
  it("is set only while a page transition runs", () => {
    const declarations = css.match(/[^{}]*\{[^{}]*view-transition-name: main/g);

    expect(declarations).toHaveLength(1);
    expect(declarations?.[0]).toContain(":active-view-transition-type(page)");
  });
});
