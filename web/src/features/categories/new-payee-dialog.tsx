import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import { useCreatePayeeRecord } from "@/features/categories/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

export function NewPayeeDialog({
  onDone,
  onCancel,
}: {
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const formId = useId();
  const create = useCreatePayeeRecord();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payees.new")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (trimmed === "") return;
              setError(null);
              create
                .mutateAsync(trimmed)
                .then(() => {
                  onDone(trimmed);
                })
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            <Field invalid={error !== null} required>
              <FieldLabel>{t("payees.name")}</FieldLabel>
              <TextField
                value={name}
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
              {error !== null && <FieldError>{error}</FieldError>}
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={create.isPending}
            disabled={name.trim() === ""}
          >
            {t("payees.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
