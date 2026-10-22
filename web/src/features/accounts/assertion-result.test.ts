import { describe, expect, it } from "vitest";

import { assertionOutcome } from "@/features/accounts/assertion-result";

const money = (amount: number) => ({ amount, currency: "BRL" });
const assertion = {
  id: "a1",
  account_id: "acc",
  date: "2026-10-31",
  amount: money(1008341),
  source: "manual" as const,
  recorded_at: "2026-10-31T12:00:00Z",
  reconciled: true,
};

describe("assertionOutcome", () => {
  it.each([
    [
      "a matching balance reconciles",
      { assertion, difference: money(0), resolution: "none" as const },
      { kind: "reconciled", difference: money(0) },
    ],
    [
      "a higher balance on an auto yield account records yield (S24)",
      {
        assertion,
        difference: money(8341),
        resolution: "yield" as const,
        resolution_transaction_id: "tx-yield",
      },
      { kind: "yield", difference: money(8341), transactionId: "tx-yield" },
    ],
    [
      "an adjustment closes the difference (S26)",
      {
        assertion,
        difference: money(-210),
        resolution: "adjustment" as const,
        resolution_transaction_id: "tx-adj",
      },
      { kind: "adjustment", difference: money(-210), transactionId: "tx-adj" },
    ],
    [
      "recording the missing transactions closes it",
      {
        assertion,
        difference: money(-1000),
        resolution: "transactions_added" as const,
      },
      { kind: "added", difference: money(-1000) },
    ],
    [
      "any other difference stays open",
      {
        assertion: { ...assertion, reconciled: false },
        difference: money(-1000),
      },
      { kind: "open", difference: money(-1000) },
    ],
  ])("%s", (_, result, want) => {
    expect(assertionOutcome(result)).toEqual(want);
  });
});
