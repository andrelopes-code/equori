import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Text } from "@slotted/react/typography";

import { CopyButton } from "@/features/setup/copy-button";
import { groupsOfFour } from "@/features/setup/groups-of-four";
import styles from "@/features/setup/recovery-codes-dialog.module.css";
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
          <ol className={styles.codes}>
            {codes.map((code) => (
              <li key={code}>
                <Text size="md" className={styles.code}>
                  {groupsOfFour(code)}
                </Text>
              </li>
            ))}
          </ol>

          <div className={styles.actions}>
            <CopyButton
              text={codes.join("\n")}
              label={t("security.recovery.copyAll")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{t("security.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
