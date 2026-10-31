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
import { Field, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useT } from "@/i18n/i18n-provider";

interface PasswordDialogProps {
  title: string;
  hint: string;
  action: string;
  onConfirm: (password: string) => Promise<unknown>;
  onClose: () => void;
}

export function PasswordDialog({
  title,
  hint,
  action,
  onConfirm,
  onClose,
}: PasswordDialogProps) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open && !pending) onClose();
  };

  const handleConfirm = () => {
    setFailure(null);
    setPending(true);
    onConfirm(password)
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Field>
              <FieldLabel>{t("login.password")}</FieldLabel>
              <TextField
                type="password"
                autoComplete="current-password"
                value={password}
                onValueChange={setPassword}
              />
            </Field>
            {failure !== null && (
              <InlineMessage tone="danger" role="alert">
                {errorText(failure, t)}
              </InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button loading={pending} onClick={handleConfirm}>
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
