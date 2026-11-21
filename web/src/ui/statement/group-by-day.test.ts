import { describe, expect, it } from "vitest";

import { groupByDay } from "@/ui/statement/group-by-day";

describe("groupByDay", () => {
  it("groups consecutive rows of one date and keeps the order of the API", () => {
    const rows = [
      { id: "a", date: "2026-11-21" },
      { id: "b", date: "2026-11-21" },
      { id: "c", date: "2026-11-20" },
      { id: "d", date: "2026-11-18" },
    ];

    const days = groupByDay(rows);

    expect(days.map((d) => [d.date, d.rows.map((r) => r.id)])).toEqual([
      ["2026-11-21", ["a", "b"]],
      ["2026-11-20", ["c"]],
      ["2026-11-18", ["d"]],
    ]);
  });

  it("returns no day for no rows", () => {
    expect(groupByDay([])).toEqual([]);
  });
});
