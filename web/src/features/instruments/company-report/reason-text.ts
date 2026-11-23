import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const reasonKeys: Record<string, MessageKey> = {
  no_report: "companyReport.reason.no_report",
  chart: "companyReport.reason.chart",
  missing: "companyReport.reason.missing",
  short_history: "companyReport.reason.short_history",
  stale: "companyReport.reason.stale",
  negative_equity: "companyReport.reason.negative_equity",
  loss: "companyReport.reason.loss",
  shares: "companyReport.reason.shares",
  classes: "companyReport.reason.classes",
  unit: "companyReport.reason.unit",
  parent_income: "companyReport.reason.parent_income",
  no_price: "companyReport.reason.no_price",
  price_jump: "companyReport.reason.price_jump",
};

// Why a figure of a company has no value, in words; a reason the catalog lacks reads as missing
// data (AC9).
export function reasonText(t: TFunction, reason: string): string {
  const key = Object.hasOwn(reasonKeys, reason)
    ? reasonKeys[reason]
    : undefined;

  return t(key ?? "companyReport.missing");
}
