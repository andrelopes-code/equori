import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

// Workaround for Slotted issue #69: TableRow has no muted look, so the cells of a row that is no
// longer active draw their content in a muted Text. A neutral link inside takes that ink.
export function ScheduleCellText({
  muted,
  children,
}: {
  muted: boolean;
  children: ReactNode;
}) {
  if (!muted) return children;

  return (
    <Text size="sm" tone="muted">
      {children}
    </Text>
  );
}
