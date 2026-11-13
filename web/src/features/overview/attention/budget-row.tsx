import { Text } from "@slotted/react/typography";

import type { BudgetItem } from "@/features/overview/attention/attention";
import { itemDestination } from "@/features/overview/attention/attention-destination";
import styles from "@/features/overview/attention/attention.module.css";
import { AttentionRow } from "@/features/overview/attention/attention-row";
import { OverrunBar } from "@/features/overview/attention/overrun-bar";
import { useBudgetText } from "@/features/overview/attention/use-budget-text";

// A budget over its amount beyond the margin: the overrun in the danger tone, and the bar that
// shows how far past the amount the spending went.
export function BudgetRow({
  item,
  month,
}: {
  item: BudgetItem;
  month: string;
}) {
  const text = useBudgetText(item);

  return (
    <AttentionRow
      title={
        <span className={styles.head}>
          <span>{text.title}</span>

          <Text size="sm" tone="danger" weight="semibold" numeric="tabular">
            {text.overrun}
          </Text>
        </span>
      }
      to={itemDestination(item, month)}
      line={
        <span className={styles.budget}>
          <OverrunBar
            room={item.room.amount}
            spent={item.spent.amount}
            label={`${text.title}: ${text.amounts}`}
          />

          <Text size="sm" tone="muted" numeric="tabular">
            {text.amounts}
          </Text>
        </span>
      }
    />
  );
}
