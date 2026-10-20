import { Text } from "@slotted/react/typography";

import styles from "@/features/transactions/transactions-grid.module.css";
import type { ListRow } from "@/features/transactions/use-transaction-list";

// Money in reads in the success ink; money out and transfers keep the text's own.
export function AmountCell({ row, text }: { row: ListRow; text: string }) {
  const tone =
    !row.transfer && !row.voided && row.money.amount > 0
      ? "success"
      : "inherit";
  return (
    <Text
      numeric="tabular"
      tone={row.voided ? "muted" : tone}
      className={row.voided ? styles.struck : undefined}
    >
      {text}
    </Text>
  );
}
