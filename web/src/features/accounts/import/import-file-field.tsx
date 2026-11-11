import type { UploadFile } from "@slotted/core/upload";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Upload } from "@slotted/react/upload";

import { useT } from "@/i18n/i18n-provider";

// P4 amendment A16: the server takes a statement of at most 10 MiB.
const maxBytes = 10 * 1024 * 1024;

interface ImportFileFieldProps {
  files: readonly UploadFile[];
  refusal: string | null;
  error: string | null;
  onFilesChange: (next: readonly UploadFile[]) => void;
  onReject: (rejected: readonly UploadFile[]) => void;
}

export function ImportFileField({
  files,
  refusal,
  error,
  onFilesChange,
  onReject,
}: ImportFileFieldProps) {
  const t = useT();

  return (
    <Field required invalid={refusal !== null || error !== null}>
      <FieldLabel>{t("importFile.file")}</FieldLabel>
      <Upload
        accept=".ofx,.csv,text/csv,application/x-ofx"
        maxSize={maxBytes}
        // A statement has no thumbnail and no in-browser view worth opening.
        preview="none"
        view="none"
        files={files}
        description={t("importFile.fileHint")}
        onFilesChange={onFilesChange}
        onReject={onReject}
      />
      {(refusal ?? error) !== null && (
        <FieldError>{refusal ?? error}</FieldError>
      )}
    </Field>
  );
}
