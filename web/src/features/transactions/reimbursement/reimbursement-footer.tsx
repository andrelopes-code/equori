import { Button } from "@slotted/react/button";
import { DialogFooter } from "@slotted/react/dialog";

import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

export interface ReimbursementFooterProps {
  // RD11, RD12: with no list to work on, the footer holds only the way out.
  listless: boolean;
  // RD13: the transaction already repays an expense.
  clearable: boolean;
  pending: boolean;
  ready: boolean;
  onClear: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function ReimbursementFooter({
  listless,
  clearable,
  pending,
  ready,
  onClear,
  onClose,
  onSubmit,
}: ReimbursementFooterProps) {
  const t = useT();

  return (
    <DialogFooter>
      {clearable && (
        <Button
          className={styles.undo}
          variant="ghost"
          tone="danger"
          loading={pending}
          onClick={onClear}
        >
          {t("reimbursement.clear")}
        </Button>
      )}

      <Button variant="ghost" tone="secondary" onClick={onClose}>
        {t(listless ? "detail.close" : "detail.cancel")}
      </Button>

      {!listless && (
        <Button loading={pending} disabled={!ready} onClick={onSubmit}>
          {t("reimbursement.submit")}
        </Button>
      )}
    </DialogFooter>
  );
}
