import { Skeleton } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/planning/budgets/budgets.module.css";

interface BudgetFigureProps {
  label: string;
  // Undefined while the figure loads.
  value: string | undefined;
  note: ReactNode;
}

// One figure of the month strip: its label, its value, and the line that says what it counts.
export function BudgetFigure({ label, value, note }: BudgetFigureProps) {
  return (
    <div role="group" aria-label={label} className={styles.figure}>
      <Text size="sm" tone="muted">
        {label}
      </Text>
      {value === undefined && <Skeleton shape="text" inlineSize="8rem" />}
      {value !== undefined && (
        <Text size="lg" weight="semibold" numeric="tabular" data-figure="value">
          {value}
        </Text>
      )}
      <Text size="sm" tone="muted" numeric="tabular">
        {note}
      </Text>
    </div>
  );
}
