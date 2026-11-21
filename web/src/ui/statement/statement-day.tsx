import { ListSection } from "@slotted/react/list";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/ui/statement/statement.module.css";

interface StatementDayProps {
  label: string;
  // The day's figure at the end of its label: a total, a closing balance; absent when unknown.
  end: string | undefined;
  // The rows carry a menu beside the amount: the figure steps back to end on the amounts' edge.
  endInset?: boolean;
  children: ReactNode;
}

// A day of the statement: its name sticks while its rows scroll (spec mobile-statement, MS3).
export function StatementDay({
  label,
  end,
  endInset = false,
  children,
}: StatementDayProps) {
  return (
    <ListSection
      label={label}
      end={
        end !== undefined && (
          <Text
            size="sm"
            tone="muted"
            weight="medium"
            numeric="tabular"
            className={endInset ? styles.endInset : undefined}
          >
            {end}
          </Text>
        )
      }
      sticky
    >
      {children}
    </ListSection>
  );
}
