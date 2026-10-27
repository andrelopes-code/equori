import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useSpending } from "@/features/overview/use-spending";
import { formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

// The five categories that took the most of the month.
export function SpendingBlock({
  month,
  ...placement
}: { month: string } & Placement) {
  const t = useT();
  const [locale] = useAppLocale();
  const { base, scale, error, loading, rows, retry } = useSpending(month);
  return (
    <OverviewBlock
      placement={placement}
      link={{
        label: t("overview.spending.open"),
        options: { to: "/categories" },
      }}
      loading={loading}
      error={error}
      onRetry={retry}
      empty={
        rows.length === 0
          ? t("overview.spending.empty", {
              month: formatMonthName(month, locale).toLocaleLowerCase(locale),
            })
          : undefined
      }
    >
      <OverviewRows
        label={t("overview.spending.title")}
        rows={rows.map((row) => ({
          key: row.id,
          title: row.name,
          end:
            base === undefined || scale === null ? undefined : (
              <MoneyFigure
                amount={row.amount}
                currency={base}
                scale={scale(base)}
              />
            ),
        }))}
      />
    </OverviewBlock>
  );
}
