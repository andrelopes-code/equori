import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import {
  interestPeriodOf,
  paymentsBody,
  paymentsDraftOf,
  type PaymentsDraft,
} from "@/features/instruments/terms/payments-draft";

const t: TFunction = (key) => catalogEn[key];

const none: PaymentsDraft = { every: 0, first: "", amortizations: [] };

describe("paymentsBody", () => {
  it("sends the schedule of an interest period", () => {
    const draft = { ...none, every: 6 as const, first: "2026-07-06" };

    expect(paymentsBody(draft, t)).toEqual({
      body: { interest_every_months: 6, first_payment_on: "2026-07-06" },
    });
  });

  it("sends an amortization without interest as a payment that pays no interest", () => {
    const draft = {
      ...none,
      amortizations: [{ paysOn: "2027-03-02", percent: "50" }],
    };

    expect(paymentsBody(draft, t)).toEqual({
      body: {
        payments: [
          {
            pays_on: "2027-03-02",
            amortization_bp: 5000,
            pays_interest: false,
          },
        ],
      },
    });
  });

  it("sends the schedule and the amortizations together", () => {
    const draft: PaymentsDraft = {
      every: 6,
      first: "2026-07-06",
      amortizations: [{ paysOn: "2027-01-05", percent: "25,5" }],
    };

    expect(paymentsBody(draft, t)).toEqual({
      body: {
        interest_every_months: 6,
        first_payment_on: "2026-07-06",
        payments: [
          {
            pays_on: "2027-01-05",
            amortization_bp: 2550,
            pays_interest: false,
          },
        ],
      },
    });
  });

  it("sends nothing for a draft without payments", () => {
    expect(paymentsBody(none, t)).toEqual({ body: {} });
  });

  it("rejects a percent of more than two decimals", () => {
    const draft = {
      ...none,
      amortizations: [{ paysOn: "2027-03-02", percent: "50.555" }],
    };

    expect(paymentsBody(draft, t)).toEqual({
      errors: { "payments[0]": catalogEn["terms.invalid.percent"] },
    });
  });

  it("rejects a percent above 100 and an amortization without a date", () => {
    const draft = {
      ...none,
      amortizations: [
        { paysOn: "2027-03-02", percent: "100.01" },
        { paysOn: "", percent: "10" },
      ],
    };

    expect(paymentsBody(draft, t)).toEqual({
      errors: {
        "payments[0]": catalogEn["terms.invalid.percent"],
        "payments[1]": catalogEn["instruments.required"],
      },
    });
  });

  it("requires the first date of an interest period", () => {
    expect(paymentsBody({ ...none, every: 3 }, t)).toEqual({
      errors: { first_payment_on: catalogEn["instruments.required"] },
    });
  });
});

describe("paymentsDraftOf", () => {
  const pay = (pays_on: string, amortization_bp = 0, pays_interest = true) => ({
    pays_on,
    amortization_bp,
    pays_interest,
  });

  it("reads the period and the amortizations back from the expanded payments", () => {
    const payments = [
      pay("2026-07-02"),
      pay("2026-10-02"),
      pay("2027-01-02", 4000),
      pay("2027-04-02"),
      pay("2027-07-02", 6000),
    ];

    expect(paymentsDraftOf(payments, "2027-07-02")).toEqual({
      every: 3,
      first: "2026-07-02",
      amortizations: [
        { paysOn: "2027-01-02", percent: "40" },
        { paysOn: "2027-07-02", percent: "60" },
      ],
    });
  });

  it("reads one interest date before maturity against the maturity", () => {
    const payments = [pay("2026-07-02"), pay("2027-01-02")];

    expect(interestPeriodOf(payments, "2027-01-02")).toBe(6);
  });

  it("keeps interest on irregular dates when the terms are saved again", () => {
    const payments = [
      pay("2026-05-10"),
      pay("2026-11-20", 5000),
      pay("2027-01-05"),
    ];

    const draft = paymentsDraftOf(payments, "2027-01-05");

    expect(draft.every).toBe(0);
    expect(paymentsBody(draft, t)).toEqual({ body: { payments } });
  });

  it("reads no payments as an empty draft", () => {
    expect(paymentsDraftOf([], "2027-01-02")).toEqual(none);
    expect(interestPeriodOf([pay("2027-01-02")], "2027-01-02")).toBe(0);
  });
});
