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
import { useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

interface NameDialogProps {
  title: string;
  submitLabel: string;
  initial: string;
  pending: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

// Asks the name of a spreadsheet: the one it takes on a rename, or the one of its copy.
export function NameDialog({
  title,
  submitLabel,
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: NameDialogProps) {
  const t = useT();
  const [name, setName] = useState(initial);

  const trimmed = name.trim();
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed !== "") onSubmit(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <Field invalid={error !== null} required>
              <FieldLabel>{t("spreadsheets.name")}</FieldLabel>
              <TextField
                value={name}
                maxLength={120}
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
              {error !== null && <FieldError>{error}</FieldError>}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={pending} disabled={trimmed === ""}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
