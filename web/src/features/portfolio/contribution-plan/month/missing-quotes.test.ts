import { describe, expect, it } from "vitest";

import { missingQuotes } from "@/features/portfolio/contribution-plan/month/missing-quotes";

describe("missingQuotes", () => {
  const instruments = [
    { code: "CDB1", quote_currency: "BRL" },
    { code: "USD", quote_currency: null },
    { code: "BRL", quote_currency: null },
  ];

  it("names the quote of each entry once: the quote currency of a security, the base of a currency", () => {
    const missing = [
      { instrument: "CDB1", kind: "price" as const, account_id: "a" },
      { instrument: "CDB1", kind: "price" as const, account_id: "b" },
      { instrument: "USD", kind: "rate" as const },
    ];

    expect(missingQuotes(missing, instruments, "BRL")).toEqual([
      { instrument: "CDB1", quote: "BRL", kind: "price" },
      { instrument: "USD", quote: "BRL", kind: "rate" },
    ]);
  });

  it("leaves out an entry it cannot quote: an unknown instrument, the base itself, no base yet", () => {
    const missing = [
      { instrument: "XYZ", kind: "price" as const },
      { instrument: "BRL", kind: "rate" as const },
    ];

    expect(missingQuotes(missing, instruments, "BRL")).toEqual([]);
    expect(
      missingQuotes(
        [{ instrument: "USD", kind: "rate" }],
        instruments,
        undefined,
      ),
    ).toEqual([]);
  });
});
