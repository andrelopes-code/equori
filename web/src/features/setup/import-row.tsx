import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useRef, useState } from "react";

import { useImportArchive } from "@/features/setup/api";
import type { DataMessage } from "@/features/setup/data-message";
import {
  asksForPassphrase,
  importDone,
  importError,
} from "@/features/setup/import-text";
import { useT } from "@/i18n/i18n-provider";

interface ImportRowProps {
  // Import needs books without transactions (export design E4).
  blocked: boolean;
  onMessage: (message: DataMessage | null) => void;
}

export function ImportRow({ blocked, onMessage }: ImportRowProps) {
  const t = useT();
  const importing = useImportArchive();
  const input = useRef<HTMLInputElement>(null);
  const [passphrase, setPassphrase] = useState("");
  const [asked, setAsked] = useState(false);
  const [skipCredentials, setSkipCredentials] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (file === undefined) return;
    onMessage(null);
    importing
      .mutateAsync({ file, passphrase, skipCredentials })
      .then((result) => {
        onMessage({ tone: "success", text: importDone(result, t) });
      })
      .catch((caught: unknown) => {
        setAsked(asksForPassphrase(caught));
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
          <Stack gap={3}>
            <Field>
              <FieldLabel>{t("import.passphrase")}</FieldLabel>
              <TextField
                type="password"
                autoComplete="off"
                value={passphrase}
                onValueChange={setPassphrase}
              />
              <FieldDescription>{t("import.passphraseHint")}</FieldDescription>
            </Field>

            {asked && (
              <Checkbox
                checked={skipCredentials}
                onCheckedChange={setSkipCredentials}
              >
                {t("import.skipCredentials")}
              </Checkbox>
            )}

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
          </Stack>
        </ListItemActions>
      )}
    </ListItem>
  );
}
