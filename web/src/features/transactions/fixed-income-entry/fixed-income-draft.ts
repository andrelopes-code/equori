import { indexName } from "@/features/calculators";
import {
  bpText,
  noPayments,
  parsePercentBp,
  paymentsBody,
} from "@/features/instruments";
import type { PaymentsDraft } from "@/features/instruments";
import { formatDate } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";
import type { MoneyFormat } from "@/privacy/use-money-format";

import type { components } from "@/api/schema.gen";

type FixedIncomeApplicationInput =
  components["schemas"]["FixedIncomeApplicationInput"];

export interface FixedIncomeDraft {
  // Names the application: the same id again answers with the recorded purchase.
  applicationId: string;
  brokerageId: string | null;
  // The cash account the money leaves; null takes the single candidate of the brokerage (BC6).
  cashAccountId: string | null;
  // The application was held before the book: no cash moves and no cash account is sent (OL7).
  opening: boolean;
  // An existing contract of the book; null when the draft defines a new one.
  instrument: string | null;
  subtype: string;
  issuer: string;
  // Minor units of the brokerage currency.
  amount: number;
  currency: string;
  appliedOn: string;
  // "rate" is a percent of an index, "inflation" an index plus a rate, "fixed" a rate alone.
  returnKind: "rate" | "inflation" | "fixed";
  indexId: string;
  // The percent as typed: the percent of the index, or the rate a year.
  percent: string;
  maturesOn: string;
  dailyLiquidity: boolean;
  redeemableFrom: string | null;
  // The interest schedule and amortizations of a new contract.
  payments: PaymentsDraft;
}

export type ApplicationBodyResult =
  { body: FixedIncomeApplicationInput } | { errors: Record<string, string> };

export type SummaryFormat = Pick<MoneyFormat, "money"> & { locale: string };

export function emptyFixedIncomeDraft(
  applicationId: string,
  brokerageId: string | null,
  date: string,
): FixedIncomeDraft {
  return {
    applicationId,
    brokerageId,
    cashAccountId: null,
    opening: false,
    instrument: null,
    subtype: "",
    issuer: "",
    amount: 0,
    currency: "",
    appliedOn: date,
    returnKind: "rate",
    indexId: "",
    percent: "",
    maturesOn: "",
    dailyLiquidity: false,
    redeemableFrom: null,
    payments: noPayments,
  };
}

export function applicationBody(
  draft: FixedIncomeDraft,
  t: TFunction,
): ApplicationBodyResult {
  const errors: Record<string, string> = {};
  const bp = parsePercentBp(draft.percent);

  if (draft.amount <= 0) errors.amount = t("entry.required.amount");
  if (draft.instrument === null) {
    if (draft.issuer.trim() === "")
      errors["contract.issuer"] = t("fixedIncome.required.issuer");
    if (draft.maturesOn === "")
      errors["contract.matures_on"] = t("fixedIncome.required.maturesOn");
    if (bp === null) errors.rate = t("fixedIncome.required.rate");
  }
  if (Object.keys(errors).length > 0) return { errors };

  const body: FixedIncomeApplicationInput = {
    application_id: draft.applicationId,
    brokerage_id: draft.brokerageId ?? "",
    applied_on: draft.appliedOn,
    amount: { amount: draft.amount, currency: draft.currency },
    ...(draft.opening ? { opening: true } : {}),
    ...(draft.cashAccountId === null || draft.opening
      ? {}
      : { cash_account_id: draft.cashAccountId }),
  };
  if (draft.instrument !== null)
    return { body: { ...body, instrument: draft.instrument } };

  const payments = paymentsBody(draft.payments, t);
  if (payments.errors !== undefined) return { errors: payments.errors };

  return {
    body: {
      ...body,
      contract: { ...contractOf(draft, bp ?? 0), ...payments.body },
    },
  };
}

export function contractSummary(
  draft: FixedIncomeDraft,
  t: TFunction,
  fmt: SummaryFormat,
): string {
  return [
    `${draft.subtype.toUpperCase()} ${draft.issuer}`,
    returnText(draft, t),
    t("fixedIncome.summary.matures", {
      date: formatDate(draft.maturesOn, fmt.locale),
    }),
    fmt.money({ amount: draft.amount, currency: draft.currency }, 2),
  ].join(" · ");
}

function contractOf(draft: FixedIncomeDraft, bp: number) {
  const contract: NonNullable<FixedIncomeApplicationInput["contract"]> = {
    subtype: draft.subtype,
    issuer: draft.issuer.trim(),
    matures_on: draft.maturesOn,
    daily_liquidity: draft.dailyLiquidity,
  };
  if (draft.redeemableFrom !== null)
    contract.redeemable_from = draft.redeemableFrom;
  if (draft.returnKind === "rate") {
    return { ...contract, index_id: draft.indexId, percent_of_index_bp: bp };
  }
  if (draft.returnKind === "inflation") {
    return { ...contract, index_id: draft.indexId, spread_bp: bp };
  }

  return { ...contract, spread_bp: bp };
}

function returnText(draft: FixedIncomeDraft, t: TFunction): string {
  const rate = `${bpText(parsePercentBp(draft.percent) ?? 0)}%`;
  const index = indexName(draft.indexId);
  if (draft.returnKind === "rate")
    return t("fixedIncome.summary.percentOf", { percent: rate, index });
  if (draft.returnKind === "inflation")
    return t("fixedIncome.summary.inflation", { index, rate });

  return t("fixedIncome.summary.fixed", { rate });
}

const paymentFields =
  /^contract\.(first_payment_on|interest_every_months|payments(\[\d+\])?)$/;

// paymentErrors gives the payment fields the errors of the server, which names them under
// contract; an error of the form itself keeps its own key and wins.
export function paymentErrors(
  errors: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, message] of Object.entries(errors)) {
    const match = paymentFields.exec(key);
    if (match?.[1] !== undefined) out[match[1]] = message;
  }

  for (const [key, message] of Object.entries(errors)) {
    if (!key.startsWith("contract.")) out[key] = message;
  }

  return out;
}
