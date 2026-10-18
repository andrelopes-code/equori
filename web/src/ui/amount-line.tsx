import type { ReactNode } from "react";

import styles from "@/ui/amount-line.module.css";

// list-item moves its end part under the title below 22rem, so a money row keeps
// its amount on the label's own line, at the row's end, at every width.
export function AmountLine({
  own,
  title,
  amount,
}: {
  own: string;
  title: ReactNode;
  amount: ReactNode;
}) {
  return (
    <span data-own={own} className={styles.line}>
      <span className={styles.title}>{title}</span>
      <span className={styles.amount}>{amount}</span>
    </span>
  );
}
