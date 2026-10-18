import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import { useT } from "@/i18n/i18n-provider";

export type NamedKind = "institutions" | "payees";

// Mounted only while open, so every opening starts from a blank form.
export function NameDialog({
  kind,
  create,
  onClose,
}: {
  kind: NamedKind;
  create: (name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      await create(trimmed);
    } catch (failure) {
      setError(
        failure instanceof ProblemError
          ? problemMessage(failure.problem, t)
          : t("settings.failed"),
      );
      setPending(false);
      return;
    }
    toast.show({ title: t(`settings.${kind}.create.done`) });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`settings.${kind}.create.title`)}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>{t("settings.field.name")}</FieldLabel>
            <TextField value={name} onValueChange={setName} />
          </Field>
          {error !== null && (
            <Alert tone="danger" role="alert">
              <AlertContent>
                <AlertDescription>{error}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button tone="secondary" variant="outline" onClick={onClose}>
            {t("settings.cancel")}
          </Button>
          <Button
            disabled={trimmed === "" || pending}
            onClick={() => void submit()}
          >
            {t("settings.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
