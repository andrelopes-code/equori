import { beforeEach, describe, expect, it } from "vitest";

import {
  readRecentCategories,
  rememberCategory,
} from "@/features/categories/recent-categories";

beforeEach(() => {
  localStorage.clear();
});

describe("recent categories", () => {
  it("is empty when nothing is stored or the value is not a list", () => {
    expect(readRecentCategories()).toEqual([]);
    localStorage.setItem("equori.recent-categories", "{");
    expect(readRecentCategories()).toEqual([]);
    localStorage.setItem("equori.recent-categories", '{"a":1}');
    expect(readRecentCategories()).toEqual([]);
  });

  it("keeps the latest choice first, once, and at most five", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "c"]) rememberCategory(id);
    expect(readRecentCategories()).toEqual(["c", "f", "e", "d", "b"]);
  });
});
