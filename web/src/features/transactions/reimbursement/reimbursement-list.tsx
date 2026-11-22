import { ReimbursementRow } from "@/features/transactions/reimbursement/reimbursement-row";
import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import type { DraftRow } from "@/features/transactions/reimbursement/use-reimbursement-draft";
import { useT } from "@/i18n/i18n-provider";

export interface ReimbursementListProps {
  rows: readonly DraftRow[];
  scale: (code: string) => number;
  onCheckedChange: (row: DraftRow, checked: boolean) => void;
  onAmountChange: (row: DraftRow, minor: number) => void;
}

// The expenses of the last 90 days, under one header row that names the value columns.
export function ReimbursementList({
  rows,
  scale,
  onCheckedChange,
  onAmountChange,
}: ReimbursementListProps) {
  const t = useT();

  return (
    <div className={styles.list}>
      <div className={styles.listHead} aria-hidden="true">
        <span>{t("reimbursement.list")}</span>
        <span className={styles.remaining}>{t("reimbursement.remaining")}</span>
        <span className={styles.shareCell}>{t("reimbursement.share")}</span>
      </div>

      <ul className={styles.rows} aria-label={t("reimbursement.list")}>
        {rows.map((row) => (
          <ReimbursementRow
            key={row.item.transaction.id}
            row={row}
            scale={scale}
            onCheckedChange={(next) => {
              onCheckedChange(row, next);
            }}
            onAmountChange={(minor) => {
              onAmountChange(row, minor);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
