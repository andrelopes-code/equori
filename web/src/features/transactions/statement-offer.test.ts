import { describe, expect, it } from "vitest";

import { statementOffer } from "@/features/transactions/statement-offer";

const placement = (reference: string, closing: string) => ({
  reference,
  closing_date: closing,
  due_date: "2026-11-05",
});

describe("statementOffer", () => {
  it.each([
    [
      "the day before closing",
      "2026-10-28",
      placement("2026-11", "2026-10-29"),
      { current: "2026-11", next: "2026-12" },
    ],
    [
      "10 days before closing",
      "2026-10-19",
      placement("2026-11", "2026-10-29"),
      { current: "2026-11", next: "2026-12" },
    ],
    [
      "11 days before closing",
      "2026-10-18",
      placement("2026-11", "2026-10-29"),
      null,
    ],
    [
      "December",
      "2026-11-28",
      placement("2026-12", "2026-11-29"),
      { current: "2026-12", next: "2027-01" },
    ],
    ["no placement", "2026-10-28", null, null],
  ] as const)("%s", (_name, date, input, want) => {
    expect(statementOffer(date, input)).toEqual(want);
  });
});
