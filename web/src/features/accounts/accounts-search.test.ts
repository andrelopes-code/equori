import { describe, expect, it } from "vitest";

import { validateAccountsSearch } from "@/features/accounts/accounts-search";

describe("validateAccountsSearch", () => {
  it.each([
    [{}, {}],
    [
      { date: "2026-09-30", basis: "settled", closed: true },
      { date: "2026-09-30", basis: "settled", closed: true },
    ],
    [{ date: "2026-13-40", basis: "booked", closed: "yes" }, {}],
    [{ date: "30/09/2026", basis: "other", closed: false }, {}],
  ])("reads %j as %j", (raw, want) => {
    expect(validateAccountsSearch(raw)).toEqual(want);
  });
});
