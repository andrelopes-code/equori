import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/budget-plan.module.css";

interface PlanLedgerLineProps {
  label: string;
  amount: string;
}

// A label beside its figure, the line of the reference's ledger.
export function PlanLedgerLine({ label, amount }: PlanLedgerLineProps) {
  return (
    <div className={styles.ledgerLine}>
      <Text size="sm" tone="muted">
        {label}
      </Text>
      <Text size="sm" numeric="tabular">
        {amount}
      </Text>
    </div>
  );
}
