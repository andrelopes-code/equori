import type { components } from "@/api/schema.gen";
import type { BudgetItem } from "@/features/overview/attention/attention";
import { useBase } from "@/features/overview/model/use-base";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

// The sentences of a budget over its amount, written once for both of its rows.
export function useBudgetText(item: BudgetItem) {
  const t = useT();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const money = (m: Money) =>
    fmt.money(m, scale === null ? 0 : scale(m.currency));

  return {
    title: t("overview.attention.budgetOver", { name: item.name }),
    overrun: t("overview.attention.overrun", {
      amount: money(item.overrun),
      share: percent.format(item.share / 100),
    }),
    amounts: t("overview.budgets.of", {
      spent: money(item.spent),
      planned: money(item.room),
    }),
  };
}
