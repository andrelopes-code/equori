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
  // Interest dates that follow no period, kept as stored so a save does not drop them.
  keptInterest?: string[];
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
  const byDate = new Map<string, Payment>(
    (draft.keptInterest ?? []).map((d) => [
      d,
      { pays_on: d, amortization_bp: 0, pays_interest: true },
    ]),
  );

  if (draft.every > 0 && draft.first === "")
    errors.first_payment_on = t("instruments.required");

  draft.amortizations.forEach((row, i) => {
    const bp = parsePercentBp(row.percent);
    if (row.paysOn === "")
      errors[`payments[${String(i)}]`] = t("instruments.required");
    else if (bp === null || bp < 1 || bp > 10000)
      errors[`payments[${String(i)}]`] = t("terms.invalid.percent");
    else
      byDate.set(row.paysOn, {
        pays_on: row.paysOn,
        amortization_bp: bp,
        pays_interest: byDate.get(row.paysOn)?.pays_interest ?? false,
      });
  });

  if (Object.keys(errors).length > 0) return { errors };

  const payments = [...byDate.values()].sort((a, b) =>
    a.pays_on.localeCompare(b.pays_on),
  );

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

  const kept =
    every === 0
      ? payments.filter((p) => p.pays_interest).map((p) => p.pays_on)
      : [];

  return {
    every,
    first: every === 0 ? "" : first,
    ...(kept.length === 0 ? {} : { keptInterest: kept }),
    amortizations: payments
      .filter((p) => p.amortization_bp > 0)
      .map((p) => ({ paysOn: p.pays_on, percent: bpText(p.amortization_bp) })),
  };
}

// The stored rows keep no period: it is the equal gap, in months, between the interest dates
// before maturity. Dates that follow no period read as none.
// Interest on irregular dates reads as no period; paymentsDraftOf keeps those dates.
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

  const dates = interestDates(payments, maturesOn);

  return dates.every((d, k) => d === addMonths(dates[0] ?? d, k * period))
    ? period
    : 0;
}

// addMonths is the schedule rule of the server (A236 FC6): the day of the month of start,
// clamped to the last day of the target month.
function addMonths(start: string, months: number): string {
  const index = monthIndex(start) - 1 + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Number(start.slice(8, 10)), last);

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
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
