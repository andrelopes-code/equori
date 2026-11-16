import { indexName } from "@/features/calculators";
import { bpText, parsePercentBp } from "@/features/instruments";
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
    instrument: null,
    subtype: "",
    issuer: "",
    amount: 0,
    currency: "BRL",
    appliedOn: date,
    returnKind: "rate",
    indexId: "",
    percent: "",
    maturesOn: "",
    dailyLiquidity: false,
    redeemableFrom: null,
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
  };
  if (draft.instrument !== null)
    return { body: { ...body, instrument: draft.instrument } };

  return { body: { ...body, contract: contractOf(draft, bp ?? 0) } };
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
