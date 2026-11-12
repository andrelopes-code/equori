import { describe, expect, it } from "vitest";

import type { TreeRow } from "@/features/categories/category-tree/category-tree";
import { visibleRows } from "@/features/categories/category-tree/category-visible-rows";

describe("visibleRows", () => {
  const cases = [
    {
      name: "hides the empty row of a group that has movement",
      rows: [
        row("G", null, 100, 0),
        row("A", "G", 100, 100),
        row("B", "G", 0, 0),
      ],
      showEmpty: false,
      visible: ["G", "A"],
      count: 1,
    },
    {
      name: "keeps every row and counts the empty rows when empty rows show",
      rows: [
        row("G", null, 100, 0),
        row("A", "G", 100, 100),
        row("B", "G", 0, 0),
      ],
      showEmpty: true,
      visible: ["G", "A", "B"],
      count: 1,
    },
    {
      name: "hides a group whose rows are all hidden",
      rows: [row("H", null, 0, 0), row("C", "H", 0, 0)],
      showEmpty: false,
      visible: [],
      count: 2,
    },
    {
      name: "keeps an empty group that has a row with movement",
      rows: [row("K", null, 0, 0), row("D", "K", 50, 50), row("E", "K", 0, 0)],
      showEmpty: false,
      visible: ["K", "D"],
      count: 1,
    },
    {
      name: "keeps a row whose direct value is the only non-zero figure",
      rows: [row("P", null, 0, 10)],
      showEmpty: false,
      visible: ["P"],
      count: 0,
    },
  ];

  it.each(cases)("$name", ({ rows, showEmpty, visible, count }) => {
    const result = visibleRows(rows, showEmpty);

    expect(result.rows.map((r) => r.id)).toEqual(visible);
    expect(result.count).toBe(count);
  });
});

function row(
  id: string,
  parentId: string | null,
  subtree: number,
  own: number,
): TreeRow {
  return {
    id,
    parentId,
    entry: {
      id,
      name: id,
      path: id,
      depth: parentId === null ? 0 : 1,
      class: "expense",
      archived: false,
      uncategorized: false,
    },
    own,
    subtree,
    share: 0,
  };
}
