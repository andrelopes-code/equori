import type { ReactNode } from "react";

interface RowTextProps {
  title?: string;
  children: ReactNode;
}

// The text of a cell. It stays a plain span and the child of its cell: the grid truncates that
// span alone.
export function RowText({ title, children }: RowTextProps) {
  return <span title={title}>{children}</span>;
}
