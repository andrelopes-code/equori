import { AttentionRow } from "@/features/overview/attention/attention-row";
import type { FixedIncomeWeekItem } from "@/features/overview/attention/attention";
import { useBase } from "@/features/overview/model/use-base";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The payments of fixed income of the next 7 days, in one row of the lowest weight.
export function FixedIncomeWeekRow({ item }: { item: FixedIncomeWeekItem }) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { scale } = useBase();

  return (
    <AttentionRow
      title={t("overview.attention.fixedIncomeWeek", {
        count: numberFormatter(locale).format(item.count),
        amount: fmt.money(
          item.total,
          scale === null ? 0 : scale(item.total.currency),
        ),
      })}
    />
  );
}
