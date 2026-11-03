import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

// Asked when the reader leaves the month, the view or the page with changes not saved.
export function PlanDiscardDialog({
  pending,
  month,
  onKeep,
  onDiscard,
}: {
  pending: number;
  month: string;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const t = useT();

  return (
    <ConfirmDialog
      title={
        pending === 1
          ? t("plan.discardTitleOne")
          : t("plan.discardTitle", { count: String(pending) })
      }
      description={t("plan.discardBody", { month })}
      confirmLabel={t("plan.discard")}
      cancelLabel={t("plan.keepEditing")}
      onConfirm={onDiscard}
      onCancel={onKeep}
    />
  );
}
