import { useState } from "react";

import { errorText } from "@/api/problem";
import { useLeaveBooks } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

interface LeaveBooksDialogProps {
  onClose: () => void;
}

// A successful leave reloads the page (useLeaveBooks), so the dialog closes only on a refusal.
export function LeaveBooksDialog({ onClose }: LeaveBooksDialogProps) {
  const t = useT();
  const leave = useLeaveBooks();
  const [failure, setFailure] = useState<unknown>(null);

  function handleConfirm() {
    setFailure(null);
    leave.mutateAsync().catch((caught: unknown) => {
      setFailure(caught);
    });
  }

  return (
    <ConfirmDialog
      title={t("members.leaveTitle")}
      description={t("members.leaveHint")}
      confirmLabel={t("members.leave")}
      pending={leave.isPending}
      error={failure === null ? null : errorText(failure, t)}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}
