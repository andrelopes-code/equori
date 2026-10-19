import styles from "@/features/transactions/transaction-table.module.css";
import type { TransactionRow } from "@/features/transactions/transaction-row";
import { useT } from "@/i18n/i18n-provider";

// Ledger sheet L15: a transfer is named, an uncategorized row asks for review with a dot.
export function TransactionTableCategory({ row }: { row: TransactionRow }) {
  const t = useT();
  if (row.transfer) {
    return <span className={styles.muted}>{t("transactions.transfer")}</span>;
  }
  if (row.uncategorized) {
    return (
      <span className={styles.review}>
        <span className={styles.dot} data-own="review-dot" aria-hidden="true" />
        {t("transactions.review")}
      </span>
    );
  }
  return <>{row.category}</>;
}
