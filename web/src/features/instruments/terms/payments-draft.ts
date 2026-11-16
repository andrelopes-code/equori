import type { components } from "@/api/schema.gen";
import {
  bpText,
  parsePercentBp,
} from "@/features/instruments/terms/basis-points";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

type Terms = components["schemas"]["FixedIncomeTerms"];
type TermsInput = components["schemas"]["FixedIncomeTermsInput"];
type Payment = components["schemas"]["FixedIncomePayment"];

export const interestPeriods = [0, 1, 3, 6, 12] as const;

export type InterestPeriod = (typeof interestPeriods)[number];

export interface AmortizationDraft {
  paysOn: string;
  percent: string;
}

export interface PaymentsDraft {
  every: InterestPeriod;
  first: string;
  amortizations: AmortizationDraft[];
}

export type PaymentsBody = Pick<
  TermsInput,
  "interest_every_months" | "first_payment_on" | "payments"
>;

export type PaymentsOutcome =
  | { body: PaymentsBody; errors?: undefined }
  | { body?: undefined; errors: Record<string, string> };

export const interestKeys: Record<InterestPeriod, MessageKey> = {
  0: "terms.interestEvery.none",
  1: "terms.interestEvery.1",
  3: "terms.interestEvery.3",
  6: "terms.interestEvery.6",
  12: "terms.interestEvery.12",
};

export const noPayments: PaymentsDraft = {
  every: 0,
  first: "",
  amortizations: [],
};

// The server merges the schedule and the explicit rows by date, so the body carries each as the
// draft holds it.
export function paymentsBody(
  draft: PaymentsDraft,
  t: TFunction,
): PaymentsOutcome {
  const errors: Record<string, string> = {};
  const payments: Payment[] = [];

  if (draft.every > 0 && draft.first === "")
    errors.first_payment_on = t("instruments.required");

  draft.amortizations.forEach((row, i) => {
    const bp = parsePercentBp(row.percent);
    if (row.paysOn === "")
      errors[`payments[${String(i)}]`] = t("instruments.required");
    else if (bp === null || bp < 1 || bp > 10000)
      errors[`payments[${String(i)}]`] = t("terms.invalid.percent");
    else
      payments.push({
        pays_on: row.paysOn,
        amortization_bp: bp,
        pays_interest: false,
      });
  });

  if (Object.keys(errors).length > 0) return { errors };

  return {
    body: {
      ...(draft.every === 0
        ? {}
        : {
            interest_every_months: draft.every,
            first_payment_on: draft.first,
          }),
      ...(payments.length === 0 ? {} : { payments }),
    },
  };
}

export function paymentsDraftOf(
  payments: Payment[],
  maturesOn: string,
): PaymentsDraft {
  const every = interestPeriodOf(payments, maturesOn);
  const first = interestDates(payments, maturesOn)[0] ?? "";

  return {
    every,
    first: every === 0 ? "" : first,
    amortizations: payments
      .filter((p) => p.amortization_bp > 0)
      .map((p) => ({ paysOn: p.pays_on, percent: bpText(p.amortization_bp) })),
  };
}

// The stored rows keep no period: it is the equal gap, in months, between the interest dates
// before maturity. Dates that follow no period read as none.
// shortcut: interest on irregular dates is not rebuilt, the dialog shows none; upgrade when the
// API returns the period.
export function interestPeriodOf(
  payments: Terms["payments"],
  maturesOn: string,
): InterestPeriod {
  const months = [...interestDates(payments, maturesOn), maturesOn].map(
    monthIndex,
  );
  const gaps = months.slice(1).map((m, i) => m - (months[i] ?? m));
  const last = gaps.pop();
  const gap = gaps[0] ?? last;
  const period = interestPeriods.find((p) => p === gap);

  if (last === undefined || gap === undefined || period === undefined) return 0;
  if (gaps.some((g) => g !== gap) || last > gap) return 0;

  return period;
}

function interestDates(payments: Payment[], maturesOn: string): string[] {
  return payments
    .filter((p) => p.pays_interest && p.pays_on < maturesOn)
    .map((p) => p.pays_on)
    .sort();
}

function monthIndex(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}
