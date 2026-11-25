import { describe, expect, it } from "vitest";

import { project } from "@/features/portfolio/projection/model/project";
import { yearTableRows } from "@/features/portfolio/projection/years-block/year-table-rows";

// The six months of year-rows.test.ts: 2026 holds 2000 of contributions, 2027 holds 1000.
const projection = project({
  start: 100000,
  monthlyRate: 0.01,
  months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"],
  changes: [{ month: "2026-11-01", amount: 1000 }],
  withdrawalFrom: "2027-02",
  income: 60000,
});

// Recorded: an opening of 9000 and 500 of flows, so 9500 contributed so far.
const history = {
  from: "2026-01-01",
  to: "2026-10-31",
  currency: "BRL",
  opening: 9000,
  points: [
    { date: "2026-09-30", value: 9800, flows: 0 },
    { date: "2026-10-31", value: 10500, flows: 500 },
  ],
  indexes: [],
};

describe("yearTableRows", () => {
  it("adds the recorded contributed total to the projected contributions", () => {
    const rows = yearTableRows(projection, "1994-03-10", history);

    // 9500 + 2000 and 9500 + 2000 + 1000.
    expect(rows.map((r) => r.contributed)).toEqual([11500, 12500]);
    expect(rows.map((r) => r.contributions)).toEqual([2000, 1000]);
  });

  it("starts the total on the opening value when the history holds no point", () => {
    const rows = yearTableRows(projection, "1994-03-10", {
      ...history,
      points: [],
    });

    expect(rows.map((r) => r.contributed)).toEqual([11000, 12000]);
  });
});
