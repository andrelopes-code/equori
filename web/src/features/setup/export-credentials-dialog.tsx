import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useExportPassphrase } from "@/features/setup/use-export-passphrase";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

interface ExportCredentialsDialogProps {
  onConfirm: (passphrase: string) => Promise<unknown>;
  onClose: () => void;
}

// Proposes the passphrase that seals the credentials of the archive (export design C1, T9). The
// owner confirms that it is saved. A passphrase the owner types is typed twice: a typo makes the
// credentials of the archive unrecoverable.
export function ExportCredentialsDialog({
  onConfirm,
  onClose,
}: ExportCredentialsDialogProps) {
  const t = useT();
  const draft = useExportPassphrase();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const handleCopy = () => {
    void navigator.clipboard.writeText(draft.passphrase);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !pending) onClose();
  };

  const handleConfirm = () => {
    setFailure(null);
    if (!draft.check()) return;
    setPending(true);
    onConfirm(draft.passphrase)
      .then(onClose)
      .catch((caught: unknown) => {
        setFailure(caught);
        setPending(false);
      });
  };

  return (
    <Dialog open size="sm" onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("export.withCredentials")}</DialogTitle>
          <DialogDescription>
            {t("export.credentials.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Field required invalid={draft.problem === "tooShort"}>
              <FieldLabel>{t("export.credentials.passphrase")}</FieldLabel>
              <TextField
                type={draft.proposed ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={draft.passphrase}
                onValueChange={draft.setPassphrase}
              />
              <FieldDescription>
                {t("export.credentials.hint")}
              </FieldDescription>
              {draft.problem === "tooShort" && (
                <FieldError live="assertive">
                  {t("export.credentials.tooShort")}
                </FieldError>
              )}
            </Field>

            {draft.proposed && (
              <Button variant="outline" tone="secondary" onClick={handleCopy}>
                {t("export.credentials.copy")}
              </Button>
            )}

            {draft.proposed && (
              <Field required invalid={draft.problem === "unsaved"}>
                <Checkbox
                  checked={draft.saved}
                  onCheckedChange={draft.setSaved}
                >
                  {t("export.credentials.saved")}
                </Checkbox>
                {draft.problem === "unsaved" && (
                  <FieldError live="assertive">
                    {t("export.credentials.unsaved")}
                  </FieldError>
                )}
              </Field>
            )}

            {!draft.proposed && (
              <Field required invalid={draft.problem === "mismatch"}>
                <FieldLabel>{t("export.credentials.confirm")}</FieldLabel>
                <TextField
                  type="password"
                  autoComplete="new-password"
                  value={draft.confirmation}
                  onValueChange={draft.setConfirmation}
                />
                {draft.problem === "mismatch" && (
                  <FieldError live="assertive">
                    {t("export.credentials.mismatch")}
                  </FieldError>
                )}
              </Field>
            )}

            {failure !== null && (
              <FormNotice>{errorText(failure, t)}</FormNotice>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button loading={pending} onClick={handleConfirm}>
            {t("export.request")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
