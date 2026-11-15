import type { MonthCell } from "@/features/planning/subscriptions/subscription-figures";
import styles from "@/features/planning/subscriptions/subscriptions.module.css";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface SubscriptionMonthsProps {
  cells: readonly MonthCell[];
  scale: (code: string) => number;
}

// The last 12 months of one subscription, one cell per month: paid at the expected amount, paid
// at another amount, skipped, expected, or no charge (spec C3). Built here: no family draws a row
// of month cells; the sparkline draws a line of values, not the state of each month.
export function SubscriptionMonths({ cells, scale }: SubscriptionMonthsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const words = (cell: MonthCell) => {
    const month = formatReferenceMonth(cell.month, locale);
    const money = (m: MonthCell["charged"]) =>
      m === undefined ? "" : fmt.money(m, scale(m.currency));
    if (cell.state === "paid")
      return t("subscriptions.cell.paid", {
        month,
        amount: money(cell.charged),
      });
    if (cell.state === "other")
      return t("subscriptions.cell.other", {
        month,
        amount: money(cell.charged),
        expected: money(cell.expected),
      });
    return t(`subscriptions.cell.${cell.state}`, { month });
  };
  const all = cells.map(words);

  return (
    <span className={styles.months} role="img" aria-label={all.join("; ")}>
      {cells.map((cell, index) => (
        <i
          key={cell.month}
          className={styles.cell}
          data-state={cell.state}
          title={all[index]}
        />
      ))}
    </span>
  );
}
