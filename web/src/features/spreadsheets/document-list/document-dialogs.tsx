import { useState } from "react";

import { errorText } from "@/api/problem";
import {
  useCopySpreadsheet,
  useDeleteSpreadsheet,
  useRenameSpreadsheet,
} from "@/features/spreadsheets/api";
import type { SpreadsheetSummary } from "@/features/spreadsheets/api";
import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import { NameDialog } from "@/features/spreadsheets/document-list/name-dialog";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";

interface DocumentDialogsProps {
  command: DocumentCommand | null;
  onCancel: () => void;
  // The command ran; result is the renamed spreadsheet or the new copy.
  onDone: (command: DocumentCommand, result?: SpreadsheetSummary) => void;
}

// The dialog of the command in course: the name of a rename or of a copy, or the confirmation
// of a deletion.
export function DocumentDialogs({
  command,
  onCancel,
  onDone,
}: DocumentDialogsProps) {
  const t = useT();
  const rename = useRenameSpreadsheet();
  const copy = useCopySpreadsheet();
  const remove = useDeleteSpreadsheet();
  const [error, setError] = useState<string | null>(null);

  if (command === null) return null;

  const { id, name } = command.document;

  function fail(caught: unknown) {
    setError(errorText(caught, t));
  }

  function handleCancel() {
    setError(null);
    onCancel();
  }

  function handleName(next: string) {
    if (command === null) return;

    setError(null);

    if (command.kind === "copy") {
      copy
        .mutateAsync({ id, name: next })
        .then((created) => {
          onDone(command, created);
        })
        .catch(fail);
      return;
    }

    rename
      .mutateAsync({ id, name: next })
      .then((renamed) => {
        onDone(command, renamed);
      })
      .catch(fail);
  }

  function handleDelete() {
    if (command === null) return;

    setError(null);
    remove
      .mutateAsync(id)
      .then(() => {
        onDone(command);
      })
      .catch(fail);
  }

  if (command.kind === "delete")
    return (
      <ConfirmDialog
        title={t("spreadsheets.deleteTitle", { name })}
        description={t("spreadsheets.deleteDescription")}
        confirmLabel={t("spreadsheets.delete")}
        pending={remove.isPending}
        error={error}
        onConfirm={handleDelete}
        onCancel={handleCancel}
      />
    );

  const copying = command.kind === "copy";

  return (
    <NameDialog
      key={command.kind}
      title={t(copying ? "spreadsheets.copyTitle" : "spreadsheets.renameTitle")}
      submitLabel={t(copying ? "spreadsheets.create" : "spreadsheets.save")}
      initial={copying ? t("spreadsheets.copyName", { name }) : name}
      pending={copying ? copy.isPending : rename.isPending}
      error={error}
      onSubmit={handleName}
      onCancel={handleCancel}
    />
  );
}
