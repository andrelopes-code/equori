import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useRef } from "react";

import { useImportArchive } from "@/features/setup/api";
import type { DataMessage } from "@/features/setup/data-message";
import { ImportCredentialsFields } from "@/features/setup/import-credentials-fields";
import {
  asksForPassphrase,
  importDone,
  importError,
} from "@/features/setup/import-text";
import { SettingsRow } from "@/features/setup/settings-row";
import { useImportCredentials } from "@/features/setup/use-import-credentials";
import { useT } from "@/i18n/i18n-provider";

interface ImportRowProps {
  // Import needs books without transactions (export design E4).
  blocked: boolean;
  onMessage: (message: DataMessage | null) => void;
}

export function ImportRow({ blocked, onMessage }: ImportRowProps) {
  const t = useT();
  const importing = useImportArchive();
  const credentials = useImportCredentials();
  const input = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (file === undefined) return;
    onMessage(null);
    importing
      .mutateAsync({
        file,
        passphrase: credentials.passphrase,
        skipCredentials: credentials.skip,
      })
      .then((result) => {
        onMessage({ tone: "success", text: importDone(result, t) });
      })
      .catch((caught: unknown) => {
        credentials.setAsked(asksForPassphrase(caught));
        onMessage({ tone: "danger", text: importError(caught, t) });
      });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    handleFile(file);
  };

  return (
    <SettingsRow
      stacked
      label={t("import.label")}
      description={blocked ? t("import.blocked") : t("import.description")}
    >
      {!blocked && (
        <Stack gap={5}>
          <ImportCredentialsFields credentials={credentials} />

          <div>
            <VisuallyHidden>
              <input
                ref={input}
                type="file"
                accept="application/zip,.zip"
                aria-label={t("import.choose")}
                onChange={handleChange}
              />
            </VisuallyHidden>
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              loading={importing.isPending}
              onClick={() => input.current?.click()}
            >
              {t("import.choose")}
            </Button>
          </div>
        </Stack>
      )}
    </SettingsRow>
  );
}
