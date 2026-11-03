import { Field, FieldError } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { meQuery, useSetDisplayName } from "@/features/session";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { useT } from "@/i18n/i18n-provider";

// The name is saved when the field loses focus; an unchanged name sends nothing, an empty one clears it.
export function SettingsDisplayName() {
  const t = useT();
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  const update = useSetDisplayName();
  const [draft, setDraft] = useState<string | null>(null);

  if (me === undefined) return null;

  const stored = me.display_name ?? "";
  const shown = draft ?? stored;

  function handleBlur() {
    const next = shown.trim();
    setDraft(null);
    if (next === stored) return;
    update.mutate(next);
  }

  return (
    <SettingsGroup title={t("settings.account.profile")}>
      <SettingsRow
        label={t("settings.account.displayName")}
        description={t("settings.account.displayName.help")}
      >
        <Field necessity="none" invalid={update.isError}>
          <TextField
            aria-label={t("settings.account.displayName")}
            value={shown}
            maxLength={60}
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
