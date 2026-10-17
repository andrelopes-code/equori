import { describe, expect, it } from "vitest";

import { validateTransactionSearch } from "@/features/transactions/search";

describe("validateTransactionSearch", () => {
  it("drops invalid search params", () => {
    expect(
      validateTransactionSearch({
        account_id: "x",
        from: "2026-13-40",
        q: "  ",
        uncategorized: "yes",
      }),
    ).toEqual({});
  });

  it("keeps a valid object unchanged", () => {
    const valid = {
      account_id: "0b0e5f56-6a2a-4f0b-9d5c-3f7f2f0d6a11",
      payee_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      tag: "viagem",
      from: "2026-10-01",
      to: "2026-10-31",
      uncategorized: true as const,
      q: "mercado",
    };
    expect(validateTransactionSearch(valid)).toEqual(valid);
  });

  it("trims q and rejects one over 100 characters", () => {
    expect(validateTransactionSearch({ q: "  mercado " })).toEqual({
      q: "mercado",
    });
    expect(validateTransactionSearch({ q: "a".repeat(101) })).toEqual({});
    expect(validateTransactionSearch({ q: "a".repeat(100) })).toEqual({
      q: "a".repeat(100),
    });
  });

  it("rejects impossible calendar dates and accepts a leap day", () => {
    expect(validateTransactionSearch({ from: "2026-02-30" })).toEqual({});
    expect(validateTransactionSearch({ to: "2028-02-29" })).toEqual({
      to: "2028-02-29",
    });
  });

  it("reads a number the router parsed from the URL as text", () => {
    expect(validateTransactionSearch({ q: 2026, tag: 7 })).toEqual({
      q: "2026",
      tag: "7",
    });
  });

  it("accepts uncategorized only as true", () => {
    expect(validateTransactionSearch({ uncategorized: true })).toEqual({
      uncategorized: true,
    });
    expect(validateTransactionSearch({ uncategorized: false })).toEqual({});
  });
});
