import { Button } from "@slotted/react/button";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useRef } from "react";

import { useImportArchive } from "@/features/setup/api";
import type { DataMessage } from "@/features/setup/data-message";
import {
  asksForPassphrase,
  importDone,
  importError,
} from "@/features/setup/import-text";
import type { ImportCredentials } from "@/features/setup/use-import-credentials";
import { useT } from "@/i18n/i18n-provider";

interface ImportRowProps {
  // Import needs books without transactions (export design E4).
  blocked: boolean;
  credentials: ImportCredentials;
  onMessage: (message: DataMessage | null) => void;
}

export function ImportRow({ blocked, credentials, onMessage }: ImportRowProps) {
  const t = useT();
  const importing = useImportArchive();
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

  return (
    <ListItem>
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>{t("import.label")}</ListItemLabel>
          <ListItemDescription>
            {blocked ? t("import.blocked") : t("import.description")}
          </ListItemDescription>
        </ListItemBody>
      </ListItemContent>
      {!blocked && (
        <ListItemActions>
          <VisuallyHidden>
            <input
              ref={input}
              type="file"
              accept="application/zip,.zip"
              aria-label={t("import.choose")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                handleFile(file);
              }}
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
        </ListItemActions>
      )}
    </ListItem>
  );
}
