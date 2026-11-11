import { Text } from "@slotted/react/typography";

import styles from "@/features/transactions/transactions-grid/transactions-grid.module.css";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";
import { directionOf, useAmountTone } from "@/ui/amount-tone";

// The amount is what the reader scans for: it takes the row's strongest weight. Money in reads
// in the success ink; money out and transfers keep the text's own.
export function AmountCell({ row, text }: { row: ListRow; text: string }) {
  const amountTone = useAmountTone();
  const direction = row.transfer ? "none" : directionOf(row.money.amount);

  return (
    <Text
      numeric="tabular"
      weight="semibold"
      tone={row.voided ? "muted" : amountTone("flow", direction)}
      className={row.voided ? styles.struck : undefined}
    >
      {text}
    </Text>
  );
}
