import { Field, FieldError } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { booksQuery, useUpdateBooks } from "@/features/setup/api";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { useT } from "@/i18n/i18n-provider";

// The name is saved when the field loses focus; an empty or unchanged name sends nothing.
export function SettingsBooksName() {
  const t = useT();
  const books = useQuery(booksQuery(useApi()));
  const update = useUpdateBooks();
  const [draft, setDraft] = useState<string | null>(null);

  if (books.data === undefined) return null;

  const { name, region, time_zone } = books.data;
  const shown = draft ?? name;

  function handleBlur() {
    const next = shown.trim();
    setDraft(null);
    if (next === "" || next === name) return;
    update.mutate({ name: next, region, time_zone });
  }

  return (
    <SettingsGroup title={t("settings.books.title")}>
      <SettingsRow
        label={t("settings.books.name")}
        description={t("settings.books.name.help")}
      >
        <Field necessity="none" invalid={update.isError}>
          <TextField
            aria-label={t("settings.books.name")}
            value={shown}
            maxLength={120}
            readOnly={update.isPending}
            onValueChange={setDraft}
            onBlur={handleBlur}
          />
          {update.isError && (
            <FieldError>{errorText(update.error, t)}</FieldError>
          )}
        </Field>
      </SettingsRow>
    </SettingsGroup>
  );
}
