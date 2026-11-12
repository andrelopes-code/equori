import { describe, expect, it } from "vitest";

import { shortfall } from "@/features/transactions/brokerage-account/cash-state";

describe("shortfall", () => {
  it.each([
    { effect: -151240, balance: 100000, want: 51240 },
    { effect: -100000, balance: 100000, want: null },
    { effect: 50000, balance: 0, want: null },
    { effect: null, balance: 0, want: null },
    { effect: -100, balance: undefined, want: null },
  ])(
    "returns $want for $effect against $balance",
    ({ effect, balance, want }) => {
      expect(shortfall(effect, balance)).toBe(want);
    },
  );
});
