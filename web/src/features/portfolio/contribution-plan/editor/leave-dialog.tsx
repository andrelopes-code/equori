import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";

interface LeaveDialogProps {
  onKeep: () => void;
  onDiscard: () => void;
}

// Asked when the reader leaves the page with targets not saved.
export function LeaveDialog({ onKeep, onDiscard }: LeaveDialogProps) {
  const t = useT();

  return (
    <ConfirmDialog
      title={t("contributionPlan.leaveTitle")}
      description={t("contributionPlan.leaveBody")}
      confirmLabel={t("contributionPlan.discard")}
      cancelLabel={t("contributionPlan.keepEditing")}
      onConfirm={onDiscard}
      onCancel={onKeep}
    />
  );
}
