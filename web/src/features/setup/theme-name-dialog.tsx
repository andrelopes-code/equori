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
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import { themeName } from "@/theme/theme-file";
import { useStableCallback } from "@/ui/use-stable-callback";

export interface ThemeNameDialogProps {
  title: string;
  description?: string;
  initialName: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

// Names a theme to save or renames a saved one.
export function ThemeNameDialog({
  title,
  description,
  initialName,
  onSubmit,
  onClose,
}: ThemeNameDialogProps) {
  const t = useT();
  const formId = useId();

  const [name, setName] = useState(initialName);
  const [invalid, setInvalid] = useState(false);

  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  function handleSubmit() {
    const valid = themeName(name);
    if (valid === null) {
      setInvalid(true);
      return;
    }

    onSubmit(valid);
    onClose();
  }

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <Field invalid={invalid} required>
              <FieldLabel>{t("settings.theme.name")}</FieldLabel>
              <TextField
                name="name"
                value={name}
                maxLength={40}
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
              {invalid && (
                <FieldError>{t("settings.theme.nameInvalid")}</FieldError>
              )}
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={name.trim() === ""}>
            {t("settings.theme.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
