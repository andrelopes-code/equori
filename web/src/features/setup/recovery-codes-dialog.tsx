import { Button } from "@slotted/react/button";
import { CodeBlock } from "@slotted/react/code-block";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import { groupsOfFour } from "@/features/setup/groups-of-four";
import { useT } from "@/i18n/i18n-provider";

interface RecoveryCodesDialogProps {
  codes: string[];
  onClose: () => void;
}

export function RecoveryCodesDialog({
  codes,
  onClose,
}: RecoveryCodesDialogProps) {
  const t = useT();

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open size="sm" onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("security.recovery.title")}</DialogTitle>
          <DialogDescription>
            {t("security.recovery.dialogHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <CodeBlock
            code={codes.map(groupsOfFour).join("\n")}
            title={t("security.recovery.title")}
          />
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{t("security.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
