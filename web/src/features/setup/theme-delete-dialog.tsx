import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

export interface ThemeDeleteDialogProps {
  name: string;
  onDelete: () => void;
  onClose: () => void;
}

export function ThemeDeleteDialog({
  name,
  onDelete,
  onClose,
}: ThemeDeleteDialogProps) {
  const t = useT();

  function handleDelete() {
    onDelete();
    onClose();
  }

  return (
    <ConfirmDialog
      title={t("settings.theme.deleteTitle", { name })}
      description={t("settings.theme.deleteHint")}
      confirmLabel={t("settings.theme.delete")}
      onConfirm={handleDelete}
      onCancel={onClose}
    />
  );
}
