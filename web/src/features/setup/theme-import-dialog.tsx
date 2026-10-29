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
import { Stack } from "@slotted/react/stack";
import { Textarea } from "@slotted/react/textarea";
import { useId, useRef, useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import { parseTheme } from "@/theme/theme-file";
import type { ThemeValues } from "@/theme/themes";
import { useStableCallback } from "@/ui/use-stable-callback";

export interface ThemeImportDialogProps {
  onImport: (name: string, values: ThemeValues) => void;
  onClose: () => void;
}

// Reads an exported theme from pasted text or a chosen file. The text is untrusted: parseTheme
// refuses the whole file on its first invalid value (spec A6).
export function ThemeImportDialog({
  onImport,
  onClose,
}: ThemeImportDialogProps) {
  const t = useT();
  const formId = useId();

  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  function handleSubmit() {
    const theme = parseTheme(text);
    if (theme === null) {
      setInvalid(true);
      return;
    }

    onImport(theme.name, theme.values);
    onClose();
  }

  function handleFile(file: File | undefined) {
    if (file === undefined) return;

    file
      .text()
      .then((content) => {
        setText(content);
        setInvalid(false);
      })
      .catch(() => {
        setInvalid(true);
      });
  }

  return (
    <Dialog open size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.theme.importTitle")}</DialogTitle>
          <DialogDescription>
            {t("settings.theme.importHint")}
          </DialogDescription>
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
            <Stack gap={4}>
              <Field invalid={invalid} required>
                <FieldLabel>{t("settings.theme.importText")}</FieldLabel>
                <Textarea
                  name="theme"
                  rows={8}
                  value={text}
                  spellCheck={false}
                  onChange={(event) => {
                    setText(event.target.value);
                    setInvalid(false);
                  }}
                />
                {invalid && (
                  <FieldError>{t("settings.theme.importInvalid")}</FieldError>
                )}
              </Field>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  handleFile(event.target.files?.[0]);
                }}
              />
              <div>
                <Button
                  variant="outline"
                  tone="secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  {t("settings.theme.importFile")}
                </Button>
              </div>
            </Stack>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={text.trim() === ""}>
            {t("settings.theme.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
