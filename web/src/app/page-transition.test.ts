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
