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
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { booksQuery } from "@/features/setup/api";
import { ArchiveFileButton } from "@/features/setup/archive-file-button";
import type { DataMessage } from "@/features/setup/data-message";
import { ImportCredentialsFields } from "@/features/setup/import-credentials-fields";
import { useArchiveImport } from "@/features/setup/use-archive-import";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";
import { useStableCallback } from "@/ui/use-stable-callback";

interface ReplaceBooksDialogProps {
  onMessage: (message: DataMessage | null) => void;
  onClose: () => void;
}

// The owner types the book name before choosing the archive that replaces its content (export
// design R1 to R4). A refused import keeps the dialog open with the refusal.
export function ReplaceBooksDialog({
  onMessage,
  onClose,
}: ReplaceBooksDialogProps) {
  const t = useT();
  const books = useQuery(booksQuery(useApi()));
  const [typed, setTyped] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  const archive = useArchiveImport(handleOutcome);

  const name = books.data?.name;
  const matches = name !== undefined && typed === name;

  function handleOutcome(message: DataMessage | null) {
    setFailure(message?.tone === "danger" ? message.text : null);
    if (message?.tone !== "success") return;
    onMessage(message);
    onClose();
  }

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("import.replace.title")}</DialogTitle>
          <DialogDescription>
            {t("import.replace.hint", { name: name ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Stack gap={5}>
            <Field necessity="none">
              <FieldLabel>{t("import.replace.confirm")}</FieldLabel>
              <TextField value={typed} onValueChange={setTyped} />
            </Field>
            <ImportCredentialsFields credentials={archive.credentials} />
            {failure !== null && <FormNotice>{failure}</FormNotice>}
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <ArchiveFileButton
            tone="danger"
            loading={archive.pending}
            disabled={!matches}
            onFile={(file) => {
              archive.send(file, typed);
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
