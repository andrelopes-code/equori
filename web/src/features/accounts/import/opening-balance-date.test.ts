import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { openingBalanceDate } from "@/features/accounts/import/opening-balance-date";

type Transaction = components["schemas"]["Transaction"];

describe("openingBalanceDate", () => {
  it.each([
    ["no entry", [], undefined],
    ["another account", [entry("2026-10-01", "b")], undefined],
    ["a voided entry", [entry("2026-10-01", "a", true)], undefined],
    [
      "its entry",
      [entry("2026-10-05", "b"), entry("2026-10-10", "a")],
      "2026-10-10",
    ],
    [
      "its first",
      [entry("2026-10-10", "a"), entry("2026-10-08", "a")],
      "2026-10-08",
    ],
  ])("%s", (_, entries, want) => {
    expect(openingBalanceDate(entries, "a")).toBe(want);
  });
});

function entry(date: string, account: string, voided = false): Transaction {
  return {
    date,
    postings: [{ account_id: account }, { account_id: "opening" }],
    ...(voided ? { voided_at: "2026-10-11T12:00:00Z" } : {}),
  } as unknown as Transaction;
}
