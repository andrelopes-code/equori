import { Text } from "@slotted/react/typography";

import { periodTotals } from "@/features/transactions/model/period-totals";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface StatementDayTotalProps {
  rows: readonly ListRow[];
  scale: (code: string) => number;
}

// What the day changed: money in less money out of its loaded rows, transfers and voided rows
// left out; nothing for a day of more than one currency (spec MS3).
export function StatementDayTotal({ rows, scale }: StatementDayTotalProps) {
  const fmt = useMoneyFormat();

  const totals = periodTotals(rows);
  if (totals === null) return null;

  const money = {
    amount: totals.income + totals.expense,
    currency: totals.currency,
  };

  return (
    <Text size="sm" tone="muted" weight="medium" numeric="tabular">
      {fmt.signed(money, scale(totals.currency))}
    </Text>
  );
}
