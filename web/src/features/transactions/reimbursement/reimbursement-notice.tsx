import type { ReactNode } from "react";

import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";

export interface ReimbursementNoticeProps {
  title: string;
  text: string;
  action?: ReactNode;
}

// RD11, RD12: the body when there is no list to show, with the way forward under it.
export function ReimbursementNotice({
  title,
  text,
  action,
}: ReimbursementNoticeProps) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyText}>{text}</p>
      {action}
    </div>
  );
}
