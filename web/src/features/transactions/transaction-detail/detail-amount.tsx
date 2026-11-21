import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/transactions/transaction-detail/transaction-detail.module.css";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";

type Money = components["schemas"]["Money"];

interface DetailAmountProps {
  money: Money;
  scale: (code: string) => number;
  transfer: boolean;
  voided: boolean;
}

// The amount of a transaction alone on its line, signed and toned as its statement row (spec
// 2026-11-21-mobile-transaction-detail, MD3).
export function DetailAmount({
  money,
  scale,
  transfer,
  voided,
}: DetailAmountProps) {
  const fmt = useMoneyFormat();
  const amountTone = useAmountTone();

  const direction = transfer ? "none" : directionOf(money.amount);

  return (
    <Text
      data-testid="detail-amount"
      size="3xl"
      weight="semibold"
      numeric="tabular"
      tone={voided ? "muted" : amountTone("flow", direction)}
      className={voided ? styles.struck : styles.amount}
    >
      {fmt.signed(money, scale(money.currency))}
    </Text>
  );
}
