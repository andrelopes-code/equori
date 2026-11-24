import type { ReactNode } from "react";

import styles from "@/features/instruments/catalog/row-text.module.css";
import type { CatalogRow } from "@/features/instruments/model/catalog-rows";

interface RowTextProps {
  row: CatalogRow;
  title?: string;
  children: ReactNode;
}

// The text of a cell in the ink of its row. It stays a plain span and the child of its cell: the
// grid truncates that span alone.
export function RowText({ row, title, children }: RowTextProps) {
  return (
    <span className={inkOf(row)} title={title}>
      {children}
    </span>
  );
}

function inkOf(row: CatalogRow) {
  if (row.hidden) return styles.hidden;

  return row.type === "currency" ? styles.unselectable : undefined;
}
