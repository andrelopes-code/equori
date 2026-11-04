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
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

const minLength = 8;
const maxLength = 256;

interface ExportCredentialsDialogProps {
  onConfirm: (passphrase: string) => Promise<unknown>;
  onClose: () => void;
}

// Asks for the passphrase that seals the credentials of the archive (export design C1). The
// passphrase is typed twice: a typo makes the credentials of the archive unrecoverable.
export function ExportCredentialsDialog({
  onConfirm,
  onClose,
}: ExportCredentialsDialogProps) {
  const t = useT();
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [invalid, setInvalid] = useState<"tooShort" | "mismatch" | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open && !pending) onClose();
  };

  const handleConfirm = () => {
    setFailure(null);
    const length = Array.from(passphrase).length;
    if (length < minLength || length > maxLength) {
      setInvalid("tooShort");
      return;
    }
    if (passphrase !== confirmation) {
      setInvalid("mismatch");
      return;
    }
    setInvalid(null);
    setPending(true);
    onConfirm(passphrase)
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
            <Field required invalid={invalid === "tooShort"}>
              <FieldLabel>{t("export.credentials.passphrase")}</FieldLabel>
              <TextField
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onValueChange={setPassphrase}
              />
              <FieldDescription>
                {t("export.credentials.hint")}
              </FieldDescription>
              {invalid === "tooShort" && (
                <FieldError live="assertive">
                  {t("export.credentials.tooShort")}
                </FieldError>
              )}
            </Field>

            <Field required invalid={invalid === "mismatch"}>
              <FieldLabel>{t("export.credentials.confirm")}</FieldLabel>
              <TextField
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onValueChange={setConfirmation}
              />
              {invalid === "mismatch" && (
                <FieldError live="assertive">
                  {t("export.credentials.mismatch")}
                </FieldError>
              )}
            </Field>

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
