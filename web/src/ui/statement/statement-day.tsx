import { ListSection } from "@slotted/react/list";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

interface StatementDayProps {
  label: string;
  // The day's figure at the end of its label: a total, a closing balance; absent when unknown.
  end: string | undefined;
  children: ReactNode;
}

// A day of the statement: its name sticks while its rows scroll (spec mobile-statement, MS3).
export function StatementDay({ label, end, children }: StatementDayProps) {
  return (
    <ListSection
      label={label}
      end={
        end !== undefined && (
          <Text size="sm" tone="muted" weight="medium" numeric="tabular">
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
