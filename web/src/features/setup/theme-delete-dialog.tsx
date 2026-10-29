import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

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

  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  function handleDelete() {
    onDelete();
    onClose();
  }

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.theme.deleteTitle", { name })}</DialogTitle>
          <DialogDescription>
            {t("settings.theme.deleteHint")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button tone="danger" onClick={handleDelete}>
            {t("settings.theme.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
