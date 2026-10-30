import { describe, expect, it } from "vitest";

import { categoryIconNames } from "@/features/categories/category-icon";
import { iconGroups } from "@/features/categories/icon-groups";

describe("iconGroups", () => {
  it("holds each curated icon in exactly one group", () => {
    const grouped = iconGroups.flatMap((group) => group.icons);

    expect([...grouped].sort()).toEqual([...categoryIconNames].sort());
  });
});
