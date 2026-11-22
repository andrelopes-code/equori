import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import type { StatusLine } from "@/features/transactions/reimbursement/reimbursement-status";
import { useT } from "@/i18n/i18n-provider";

export interface ReimbursementStatusProps {
  status: StatusLine | "loading";
}

// RD4: one line under the meter, in the danger tone when it keeps the submit off.
export function ReimbursementStatus({ status }: ReimbursementStatusProps) {
  const t = useT();

  const text = statusText(status, t);
  const tone = status === "loading" ? "muted" : status.tone;

  return (
    <p className={styles.status} data-tone={tone} role="status">
      {text}
    </p>
  );
}

function statusText(
  status: StatusLine | "loading",
  t: ReturnType<typeof useT>,
): string {
  if (status === "loading") return t("reimbursement.status.loading");

  switch (status.kind) {
    case "error":
      return status.text;
    case "zero":
      return t("reimbursement.status.zero", {
        description: status.description,
      });
    case "above":
      return t("reimbursement.status.above", {
        description: status.description,
      });
    case "over":
      return t("reimbursement.status.over");
    case "none":
      return t("reimbursement.status.none");
    case "count":
      return status.count === 1
        ? t("reimbursement.status.one")
        : t("reimbursement.status.many", { count: status.count });
  }
}
