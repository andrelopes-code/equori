import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { positive } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useScale } from "@/features/setup";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface ReceivedAmountProps {
  amount: Money | undefined;
}

// The amount a row receives this month. A row that receives nothing leaves the cell empty: the
// column keeps its width, so nothing moves.
export function ReceivedAmount({ amount }: ReceivedAmountProps) {
  const fmt = useMoneyFormat();
  const scale = useScale();

  return (
    <Text size="md" className={styles.amount}>
      {positive(amount) && fmt.money(amount, scale?.(amount.currency) ?? 0)}
    </Text>
  );
}
