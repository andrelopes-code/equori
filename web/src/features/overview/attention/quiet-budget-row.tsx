import { Text } from "@slotted/react/typography";

import type { BudgetItem } from "@/features/overview/attention/attention";
import { itemDestination } from "@/features/overview/attention/attention-destination";
import { AttentionRow } from "@/features/overview/attention/attention-row";
import { useBudgetText } from "@/features/overview/attention/use-budget-text";

// A budget over its amount within the margin: one muted line, outside the count.
export function QuietBudgetRow({
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
        <Text size="sm" tone="muted">
          {text.title}
        </Text>
      }
      to={itemDestination(item, month)}
      end={
        <Text size="sm" tone="muted" numeric="tabular">
          {text.overrun}
        </Text>
      }
    />
  );
}
