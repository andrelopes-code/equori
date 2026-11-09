import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { Ledger } from "@/features/reports/indicator-verdict";
import styles from "@/features/reports/month-ledger.module.css";
import type { IndicatorFormat } from "@/features/reports/use-indicator-format";
import { useT } from "@/i18n/i18n-provider";

export interface MonthLedgerProps {
  ledger: Ledger;
  format: IndicatorFormat;
}

// What came in, what went out and what stayed, with the amounts ending on one line.
export function MonthLedger({ ledger, format }: MonthLedgerProps) {
  const t = useT();
  const rows = [
    {
      key: "income",
      label: t("report.indicators.income"),
      amount: ledger.income,
      className: styles.row,
    },
    {
      key: "expense",
      label: t("report.indicators.expense"),
      amount: ledger.expense,
      className: styles.row,
    },
    {
      key: "result",
      label: t("report.indicators.result"),
      amount: ledger.result,
      className: styles.total,
    },
  ];

  return (
    <Stack gap={5}>
      {rows.map((row) => (
        <Inline
          key={row.key}
          className={row.className}
          gap={5}
          justify="between"
          align="baseline"
          wrap="nowrap"
        >
          <Text size="sm" tone="muted">
            {row.label}
          </Text>

          <Text
            className={styles.amount}
            size={row.key === "result" ? "lg" : "md"}
            weight="semibold"
          >
            {format.money(row.amount)}
          </Text>
        </Inline>
      ))}
    </Stack>
  );
}
