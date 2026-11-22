import { Skeleton } from "@slotted/react/skeleton";

import { ReimbursementScore } from "@/features/transactions/reimbursement/reimbursement-score";
import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

export interface ReimbursementPlaceholderProps {
  inflow: number;
  currency: string;
  scale: number;
}

// The widths the name placeholders take, so the rows do not read as one block.
const nameWidths = [
  styles.skName55,
  styles.skName40,
  styles.skName65,
  styles.skName35,
  styles.skName50,
  styles.skName45,
];

// RD10: the loaded dialog's shape while the candidates load; the amount received is known.
export function ReimbursementPlaceholder({
  inflow,
  currency,
  scale,
}: ReimbursementPlaceholderProps) {
  const t = useT();

  return (
    <>
      <ReimbursementScore
        inflow={inflow}
        currency={currency}
        scale={scale}
        status="loading"
        placeholder={<Skeleton className={styles.skFigure} />}
      />

      <div className={styles.list} aria-busy="true">
        <div className={styles.listHead} aria-hidden="true">
          <span>{t("reimbursement.list")}</span>
          <span className={styles.remaining}>
            {t("reimbursement.remaining")}
          </span>
          <span className={styles.shareCell}>{t("reimbursement.share")}</span>
        </div>

        <ul className={styles.rows}>
          {nameWidths.map((width) => (
            <li
              key={width}
              className={[styles.row, styles.skeletonRow].join(" ")}
            >
              <span className={styles.skCheck}>
                <Skeleton shape="block" className={styles.skBox} />
                <span className={styles.skText}>
                  <Skeleton className={width} />
                  <Skeleton className={styles.skDate} />
                </span>
              </span>
              <span className={styles.remaining}>
                <Skeleton className={styles.skAmount} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
