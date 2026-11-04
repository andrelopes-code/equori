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
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { booksQuery, useDeleteBooks } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";
import { useStableCallback } from "@/ui/use-stable-callback";

interface DeleteBooksDialogProps {
  onClose: () => void;
}

// The owner types the book name to confirm (DB2). A successful delete reloads the page
// (useDeleteBooks), so the dialog closes only on a refusal.
export function DeleteBooksDialog({ onClose }: DeleteBooksDialogProps) {
  const t = useT();
  const books = useQuery(booksQuery(useApi()));
  const remove = useDeleteBooks();
  const [typed, setTyped] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  const name = books.data?.name;
  const matches = name !== undefined && typed === name;

  function handleDelete() {
    if (name === undefined) return;
    setFailure(null);
    remove.mutateAsync(name).catch((caught: unknown) => {
      setFailure(caught);
    });
  }

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("books.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("books.delete.hint", { name: name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field necessity="none">
            <FieldLabel>{t("books.delete.confirm")}</FieldLabel>
            <TextField value={typed} onValueChange={setTyped} />
          </Field>
          {failure !== null && <FormNotice>{errorText(failure, t)}</FormNotice>}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            disabled={!matches}
            loading={remove.isPending}
            onClick={handleDelete}
          >
            {t("books.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
