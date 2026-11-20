import { describe, expect, it } from "vitest";

import { transactionsHref } from "@/features/assistant/view/forms/bars/transactions-href";

describe("transactionsHref", () => {
  it("filters the transactions by category and period", () => {
    expect(
      transactionsHref("a1", { from: "2026-10-01", to: "2026-10-31" }),
    ).toBe("/transactions?account_id=a1&from=2026-10-01&to=2026-10-31");
  });

  it("leaves out a missing bound", () => {
    expect(transactionsHref("a1", {})).toBe("/transactions?account_id=a1");
  });
});
