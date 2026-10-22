import { describe, expect, it } from "vitest";

import { validateAccountSearch } from "@/features/accounts/account-search";

describe("validateAccountSearch", () => {
  it.each([
    [{}, {}],
    [
      {
        tab: "reconciliation",
        range: 365,
        from: "2026-01-01",
        to: "2026-01-31",
        assert: true,
      },
      {
        tab: "reconciliation",
        range: 365,
        from: "2026-01-01",
        to: "2026-01-31",
        assert: true,
      },
    ],
    [{ tab: "activity", range: 90 }, {}],
    [{ tab: "other", range: 7, from: "yesterday", assert: "yes" }, {}],
  ])("reads %j as %j", (raw, want) => {
    expect(validateAccountSearch(raw)).toEqual(want);
  });
});
