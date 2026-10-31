import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { PasskeyCeremonyError } from "@/features/session";
import { useAddPasskey } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";

interface PasskeyDialogProps {
  onClose: () => void;
  onCodes: (codes: string[]) => void;
}

export function PasskeyDialog({ onClose, onCodes }: PasskeyDialogProps) {
  const t = useT();
  const add = useAddPasskey();
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<unknown>(null);

  const trimmed = name.trim();
  const describe = (caught: unknown) =>
    caught instanceof PasskeyCeremonyError
      ? t("security.passkeys.cancelled")
      : errorText(caught, t);
  const failureText = failure === null ? null : describe(failure);

  const handleOpenChange = (open: boolean) => {
    if (!open && !add.isPending) onClose();
  };

  const handleCreate = () => {
    setFailure(null);
    add
      .mutateAsync(trimmed)
      .then(({ recovery_codes }) => {
        if (recovery_codes.length > 0) onCodes(recovery_codes);
        onClose();
      })
      .catch((caught: unknown) => {
        setFailure(caught);
      });
  };

  return (
    <Dialog open size="sm" onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("security.passkeys.add")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Field>
              <FieldLabel>{t("security.passkeys.name")}</FieldLabel>
              <TextField value={name} maxLength={60} onValueChange={setName} />
              <FieldDescription>
                {t("security.passkeys.name.help")}
              </FieldDescription>
            </Field>
            {failureText !== null && (
              <InlineMessage tone="danger" role="alert">
                {failureText}
              </InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button
            loading={add.isPending}
            disabled={trimmed === ""}
            onClick={handleCreate}
          >
            {t("security.passkeys.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
