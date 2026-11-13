import { describe, expect, it } from "vitest";

import { validateAccountsSearch } from "@/features/accounts/pages/accounts-search";

describe("validateAccountsSearch", () => {
  it.each([
    [{}, {}],
    [
      { date: "2026-09-30", basis: "settled", closed: true },
      { date: "2026-09-30", basis: "settled", closed: true },
    ],
    [{ date: "2026-13-40", basis: "booked", closed: "yes" }, {}],
    [{ date: "30/09/2026", basis: "other", closed: false }, {}],
    [
      { group: "institution", order: "attention" },
      { group: "institution", order: "attention" },
    ],
    [
      { group: "none", order: "name" },
      { group: "none", order: "name" },
    ],
    // The defaults, Type and Balance, are not kept in the address (AL1).
    [{ group: "kind", order: "balance" }, {}],
    [{ group: "bank", order: "size" }, {}],
  ])("reads %j as %j", (raw, want) => {
    expect(validateAccountsSearch(raw)).toEqual(want);
  });
});
