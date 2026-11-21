import { describe, expect, it } from "vitest";

import { statementCountKey } from "@/features/transactions/transactions-statement/statement-count";

describe("statementCountKey", () => {
  it("reads N+ while more pages remain", () => {
    expect(statementCountKey(30, true, "en")).toBe(
      "transactions.statement.count.more",
    );
  });

  it("takes the locale's plural form", () => {
    expect(statementCountKey(1, false, "en")).toBe(
      "transactions.statement.count.one",
    );
    expect(statementCountKey(2, false, "en")).toBe(
      "transactions.statement.count.other",
    );
    expect(statementCountKey(1, false, "pt-BR")).toBe(
      "transactions.statement.count.one",
    );
  });
});
