import { Text } from "@slotted/react/typography";

import styles from "@/features/transactions/transactions-grid.module.css";
import { periodTotals } from "@/features/transactions/period-totals";
import type { ListRow } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// A day's group row: the day, then what the day changed — money in less money out of its loaded
// rows, transfers and voided entries left out (LP-08: the total names what it counts).
export function DayHeader({
  label,
  rows,
  scale,
}: {
  label: string;
  rows: readonly ListRow[];
  scale: (code: string) => number;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const totals = periodTotals(rows);
  const total =
    totals === null
      ? null
      : fmt.signed(
          { amount: totals.income + totals.expense, currency: totals.currency },
          scale(totals.currency),
        );
  return (
    <span className={styles.day}>
      <Text size="sm" weight="semibold">
        {label}
      </Text>
      {total !== null && (
        <Text
          size="sm"
          tone="muted"
          numeric="tabular"
          aria-label={t("transactions.dayTotal", { amount: total })}
        >
          {total}
        </Text>
      )}
    </span>
  );
}
