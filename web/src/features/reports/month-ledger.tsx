import { Text } from "@slotted/react/typography";

import type { Ledger } from "@/features/reports/indicator-verdict";
import styles from "@/features/reports/month-ledger.module.css";
import type { IndicatorFormat } from "@/features/reports/use-indicator-format";
import { useT } from "@/i18n/i18n-provider";

export interface MonthLedgerProps {
  ledger: Ledger;
  format: IndicatorFormat;
}

// What came in, what went out and what stayed: three figures side by side, a label over each
// amount, so the block is as tall as one figure and sits level with the sentence beside it.
export function MonthLedger({ ledger, format }: MonthLedgerProps) {
  const t = useT();
  const figures = [
    {
      key: "income",
      label: t("report.indicators.income"),
      amount: ledger.income,
    },
    {
      key: "expense",
      label: t("report.indicators.expense"),
      amount: ledger.expense,
    },
    {
      key: "result",
      label: t("report.indicators.result"),
      amount: ledger.result,
    },
  ];

  return (
    <div className={styles.ledger}>
      {figures.map((figure) => (
        <div key={figure.key} className={styles.figure}>
          <Text size="sm" tone="muted">
            {figure.label}
          </Text>

          <Text className={styles.amount} size="xl" weight="semibold">
            {format.money(figure.amount)}
          </Text>
        </div>
      ))}
    </div>
  );
}
