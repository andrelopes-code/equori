import { List } from "@slotted/react/list";
import type { ReactNode } from "react";

import styles from "@/ui/statement/statement.module.css";

interface StatementListProps {
  label: string;
  busy?: boolean;
  children: ReactNode;
}

// A phone statement: days of movements on the page ground, rows inside the page margin (spec
// 2026-11-21-mobile-statement).
export function StatementList({
  label,
  busy = false,
  children,
}: StatementListProps) {
  return (
    <List
      aria-label={label}
      aria-busy={busy}
      variant="plain"
      fill="inset"
      className={styles.statement}
    >
      {children}
    </List>
  );
}
