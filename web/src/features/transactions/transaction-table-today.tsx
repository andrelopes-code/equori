import styles from "@/features/transactions/transaction-table.module.css";
import { useT } from "@/i18n/i18n-provider";

// Complete frontend T4: Today parts what is only expected, above, from what happened, below.
export function TransactionTableToday({ columns }: { columns: number }) {
  const t = useT();
  return (
    <tr>
      <td colSpan={columns} className={styles.todayCell}>
        <div className={styles.today}>
          <span className={styles.todayLabel}>{t("date.today")}</span>
          <span className={styles.todayRule} aria-hidden="true" />
          <span className={styles.muted}>
            {t("transactions.upcoming.note")}
          </span>
        </div>
      </td>
    </tr>
  );
}
