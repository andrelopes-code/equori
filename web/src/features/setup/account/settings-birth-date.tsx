import { Field, FieldError } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { meQuery, useSetBirthDate } from "@/features/session";
import { SettingsRow } from "@/features/setup/settings-layout/settings-row";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/form-fields/date-input";

// PJ6: the birth date of the user, read by the projection of the portfolio; a chosen date is saved
// at once.
export function SettingsBirthDate() {
  const t = useT();
  const today = useToday();
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  const update = useSetBirthDate();

  if (me === undefined) return null;

  function handleChange(iso: string) {
    if (iso !== "" && iso !== me?.birth_date) update.mutate(iso);
  }

  return (
    <SettingsRow
      label={t("settings.account.birthDate")}
      description={t("settings.account.birthDate.help")}
    >
      <Field necessity="none" invalid={update.isError}>
        <DateInput
          name="birth_date"
          aria-label={t("settings.account.birthDate")}
          value={update.variables ?? me.birth_date ?? ""}
          onChange={handleChange}
          shortcuts={false}
          min="1900-01-01"
          max={today}
        />
        {update.isError && (
          <FieldError>{errorText(update.error, t)}</FieldError>
        )}
      </Field>
    </SettingsRow>
  );
}
