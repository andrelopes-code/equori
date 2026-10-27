import { OverviewBlock } from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useSpending } from "@/features/overview/use-spending";
import { formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

// The five categories that took the most of the month.
export function SpendingBlock({
  month,
  onHide,
}: {
  month: string;
  onHide?: (() => void) | undefined;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const { base, scale, error, loading, rows, retry } = useSpending(month);
  return (
    <OverviewBlock
      onHide={onHide}
      title={t("overview.spending.title")}
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
