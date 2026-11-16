import { describe, expect, it } from "vitest";

import { recordLink } from "@/features/instruments/terms/event-link";

const account_id = "0b0e5f56-6a2a-4f0b-9d5c-3f7f2f0d6a11";
const scale = (code: string) => (code === "BRL" ? 2 : 6);
const event = (kind: string, date: string, gross?: number) => ({
  account_id,
  instrument: "CDB1",
  date,
  kind,
  quantity: { amount: 10000000, currency: "CDB1" },
  ...(gross === undefined ? {} : { gross: { amount: gross, currency: "BRL" } }),
  rate_missing: gross === undefined,
  state: "due" as const,
});

describe("recordLink", () => {
  // S510
  it("opens an income of type coupon for an interest event", () => {
    expect(recordLink(event("interest", "2026-07-06", 60206), scale)).toBe(
      `/transactions/new?kind=investment_income&account_id=${account_id}` +
        "&income_type=coupon&date=2026-07-06&gross=60206",
    );
  });

  it("opens a sale at the unit price for a maturity event", () => {
    expect(recordLink(event("maturity", "2027-01-05", 1000000), scale)).toBe(
      `/transactions/new?kind=trade&side=sell&account_id=${account_id}` +
        "&quantity=10000000&unit_price=1000.000000000000&date=2027-01-05",
    );
  });

  it("leaves out the amount of an event whose rate is missing", () => {
    expect(recordLink(event("amortization", "2027-01-05"), scale)).toBe(
      `/transactions/new?kind=trade&side=sell&account_id=${account_id}` +
        "&quantity=10000000&date=2027-01-05",
    );
  });
});
