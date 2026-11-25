import { describe, expect, it } from "vitest";

import { contributionRows } from "@/features/portfolio/projection/contributions-block/contributions-rows";

const changes = [
  { month: "2026-09-01", amount: 100000 },
  { month: "2026-11-01", amount: 150000 },
];

describe("contributionRows", () => {
  it("PX8: bars of the recorded flows, then the steps from the current month to the withdrawal month", () => {
    const points = [
      { date: "2026-08-31", value: 0, flows: 50000, return_bp: 0 },
      { date: "2026-09-30", value: 0, flows: 60000, return_bp: 0 },
    ];

    expect(contributionRows(points, changes, "2026-10", "2026-12", 2)).toEqual([
      { date: "2026-08-31", recorded: 500, planned: null },
      { date: "2026-09-30", recorded: 600, planned: null },
      { date: "2026-10-31", recorded: null, planned: 1000 },
      { date: "2026-11-30", recorded: null, planned: 1500 },
      { date: "2026-12-31", recorded: null, planned: 1500 },
    ]);
  });

  it("PX8: keeps the last 60 months of the history", () => {
    const points = Array.from({ length: 61 }, (_, i) => ({
      date: `2026-${String(i + 1).padStart(2, "0")}-28`,
      value: 0,
      flows: i,
      return_bp: 0,
    }));
    const rows = contributionRows(points, changes, "2026-10", "2026-10", 0);

    expect(rows.filter((r) => r.recorded !== null)).toHaveLength(60);
    expect(rows[0]?.recorded).toBe(1);
  });
});
