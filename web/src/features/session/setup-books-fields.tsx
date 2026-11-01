import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useMemo } from "react";

import { timeZoneChoices } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

interface SetupBooksFieldsProps {
  timeZone: string;
  onTimeZoneChange: (next: string) => void;
}

export function SetupBooksFields({
  timeZone,
  onTimeZoneChange,
}: SetupBooksFieldsProps) {
  const t = useT();

  const choices = useMemo(
    () => timeZoneChoices(t("setup.timeZone.regionDefault"), timeZone),
    [t, timeZone],
  );

  function handleTimeZoneChange(next: string | string[] | null) {
    if (typeof next === "string") onTimeZoneChange(next);
  }

  return (
    <>
      <Field>
        <FieldLabel>{t("setup.booksName")}</FieldLabel>
        <TextField
          name="books_name"
          size="lg"
          maxLength={80}
          autoComplete="off"
          placeholder={t("setup.booksName.placeholder")}
        />
        <FieldDescription>{t("setup.booksName.help")}</FieldDescription>
      </Field>

      <Field necessity="none">
        <FieldLabel>{t("settings.timeZone")}</FieldLabel>
        <ChoiceSelect
          label={t("settings.timeZone")}
          choices={choices}
          value={timeZone}
          multiple={false}
          onChange={handleTimeZoneChange}
        />
        <FieldDescription>{t("settings.timeZone.help")}</FieldDescription>
      </Field>
    </>
  );
}
