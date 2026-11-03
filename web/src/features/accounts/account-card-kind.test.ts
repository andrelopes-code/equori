import { describe, expect, it } from "vitest";

import { accountCardColor } from "@/features/accounts/account-card-kind";

describe("accountCardColor", () => {
  // The chart colour mode rewrites --slotted-data-1..8; a card colour held in those tokens
  // would follow the accent instead of the colour chosen for the account.
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "maps slot %i to its fixed palette variable",
    (slot) => {
      expect(accountCardColor(slot)).toBe(`var(--equori-slot-${String(slot)})`);
    },
  );

  it("returns undefined without a slot", () => {
    expect(accountCardColor(undefined)).toBeUndefined();
  });
});
