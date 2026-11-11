import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { ArchiveFileButton } from "@/features/setup/data/archive-file-button";
import type { DataMessage } from "@/features/setup/data/data-message";
import { ImportCredentialsFields } from "@/features/setup/data/import-credentials-fields";
import { ReplaceBooksDialog } from "@/features/setup/data/replace-books-dialog";
import { SettingsRow } from "@/features/setup/settings-layout/settings-row";
import { useArchiveImport } from "@/features/setup/data/use-archive-import";
import { useT } from "@/i18n/i18n-provider";

interface ImportRowProps {
  // Import needs books without transactions (export design E4); books with transactions are
  // replaced through a dialog that asks for the book name (R1).
  blocked: boolean;
  onMessage: (message: DataMessage | null) => void;
}

export function ImportRow({ blocked, onMessage }: ImportRowProps) {
  const t = useT();
  const archive = useArchiveImport(onMessage);
  const [replacing, setReplacing] = useState(false);

  return (
    <SettingsRow
      stacked
      label={t("import.label")}
      description={blocked ? t("import.blocked") : t("import.description")}
    >
      {blocked && (
        <div>
          <Button
            size="sm"
            variant="outline"
            tone="danger"
            onClick={() => {
              setReplacing(true);
            }}
          >
            {t("import.replace")}
          </Button>
        </div>
      )}

      {blocked && replacing && (
        <ReplaceBooksDialog
          onMessage={onMessage}
          onClose={() => {
            setReplacing(false);
          }}
        />
      )}

      {!blocked && (
        <Stack gap={5}>
          <ImportCredentialsFields credentials={archive.credentials} />
          <ArchiveFileButton
            tone="secondary"
            loading={archive.pending}
            onFile={(file) => {
              archive.send(file);
            }}
          />
        </Stack>
      )}
    </SettingsRow>
  );
}
