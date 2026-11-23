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
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { errorText } from "@/api/problem";
import { useSetCopyPassword } from "@/features/instance";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface CopyPasswordDialogProps {
  onClose: () => void;
}

// A15.5: the password of the encrypted copies; two equal entries, 12 characters or more.
export function CopyPasswordDialog({ onClose }: CopyPasswordDialogProps) {
  const t = useT();
  const save = useSetCopyPassword();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open && !save.isPending) onClose();
  };

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (password !== repeat) {
      setMismatch(true);
      return;
    }

    setMismatch(false);
    save.mutate(password, {
      onSuccess: () => {
        toast.show({ tone: "success", title: t("backup.password.saved") });
        onClose();
      },
    });
  };

  return (
    <Dialog open size="sm" onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("backup.password.title")}</DialogTitle>
            <DialogDescription>{t("backup.password.kept")}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <FormLayout>
              <Field required>
                <FieldLabel>{t("backup.password.field")}</FieldLabel>
                <TextField
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onValueChange={setPassword}
                />
                <FieldDescription>{t("backup.password.help")}</FieldDescription>
              </Field>

              <Field required invalid={mismatch}>
                <FieldLabel>{t("backup.password.repeat")}</FieldLabel>
                <TextField
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onValueChange={setRepeat}
                />
                {mismatch && (
                  <FieldError live="assertive">
                    {t("backup.password.mismatch")}
                  </FieldError>
                )}
              </Field>

              {save.isError && (
                <FormNotice>{errorText(save.error, t)}</FormNotice>
              )}
            </FormLayout>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              tone="secondary"
              disabled={save.isPending}
              onClick={onClose}
            >
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t("backup.password.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
