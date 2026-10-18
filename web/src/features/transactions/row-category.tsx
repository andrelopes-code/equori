import type { TransactionRow } from "@/features/transactions/transaction-row";
import styles from "@/features/transactions/transaction-list.module.css";
import { useT } from "@/i18n/i18n-provider";

// Ledger sheet L15: a transfer is named, an uncategorized row asks for review.
export function RowCategory({ row }: { row: TransactionRow }) {
  const t = useT();
  if (row.transfer) {
    return <span className={styles.muted}>{t("transactions.transfer")}</span>;
  }
  if (row.uncategorized) {
    return <span className={styles.review}>{t("transactions.review")}</span>;
  }
  return <>{row.category}</>;
}
