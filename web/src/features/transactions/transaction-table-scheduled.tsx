import styles from "@/features/transactions/transaction-table.module.css";
import type { UpcomingRow } from "@/features/transactions/upcoming-row";
import { useT } from "@/i18n/i18n-provider";

// An expected occurrence: muted, dashed rule, not selectable.
export function TransactionTableScheduled({
  row,
  amount,
  brief,
}: {
  row: UpcomingRow;
  amount: string;
  brief: boolean;
}) {
  const t = useT();
  return (
    <tr data-scheduled="true">
      <td>{row.description}</td>
      <td className={styles.clip}>{row.account}</td>
      {!brief && (
        <td className={styles.clip}>
          {row.kind === undefined ? "" : t(`schedule.kind.${row.kind}`)}
        </td>
      )}
      <td data-numeric="">{amount}</td>
    </tr>
  );
}
