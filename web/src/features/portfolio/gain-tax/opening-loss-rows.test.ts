import { describe, expect, it } from "vitest";

import {
  lossRows,
  rowsToLosses,
} from "@/features/portfolio/gain-tax/opening-loss-rows";

const saved = [
  {
    pool: "ordinary",
    month: "2026-01",
    amount: { amount: 100000, currency: "BRL" },
  },
];

describe("lossRows", () => {
  it("fills the saved pool and starts the others empty at the fallback month", () => {
    expect(lossRows(["ordinary", "fii"], saved, "2026-03", {})).toEqual([
      { pool: "ordinary", month: "2026-01", amount: 100000 },
      { pool: "fii", month: "2026-03", amount: 0 },
    ]);
  });

  it("applies the edits of a pool over the saved values", () => {
    expect(
      lossRows(["ordinary"], saved, "2026-03", { ordinary: { amount: 5 } }),
    ).toEqual([{ pool: "ordinary", month: "2026-01", amount: 5 }]);
  });

  it("is empty without pools", () => {
    expect(lossRows([], saved, "2026-03", {})).toEqual([]);
  });
});

describe("rowsToLosses", () => {
  it("leaves the rows of amount zero out", () => {
    expect(
      rowsToLosses(
        [
          { pool: "ordinary", month: "2026-01", amount: 100000 },
          { pool: "fii", month: "2026-03", amount: 0 },
        ],
        "BRL",
      ),
    ).toEqual(saved);
  });
});
