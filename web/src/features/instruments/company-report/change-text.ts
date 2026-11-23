import type { components } from "@/api/schema.gen";
import { numberFormatter } from "@/i18n/format";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

type Change = components["schemas"]["CompanyChange"];

interface ChangeWords {
  loss: MessageKey;
  turned: MessageKey;
}

const words: Record<"profit" | "revenue", ChangeWords> = {
  profit: {
    loss: "companyReport.change.loss",
    turned: "companyReport.change.turned",
  },
  revenue: {
    loss: "companyReport.change.noRevenue",
    turned: "companyReport.change.revenueTurned",
  },
};

// The change of an account of a company in words: "subiu 20%", "caiu 1,7%", "prejuízo" (AC8).
export function changeText(
  t: TFunction,
  locale: string,
  change: Change,
  account: "profit" | "revenue" = "profit",
): string {
  if (change.state === "loss") return t(words[account].loss);
  if (change.state === "turned") return t(words[account].turned);
  if (change.rate === undefined) return t("companyReport.missing");

  const tenths = Math.round(Number(change.rate) * 1000) / 10;

  if (tenths === 0) return t("companyReport.change.flat");

  const size = Math.abs(tenths);
  const rate = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: size < 10 ? 1 : 0,
  }).format(size / 100);

  return t(
    tenths > 0 ? "companyReport.change.up" : "companyReport.change.down",
    { rate },
  );
}
