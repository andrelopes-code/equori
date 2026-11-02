import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useMemo } from "react";

import { currencyChoices } from "@/features/session/currency-choices";
import { timeZoneChoices } from "@/features/setup";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import widths from "@/ui/field-width.module.css";

interface SetupBooksFieldsProps {
  currency: string;
  currencyError: string | undefined;
  timeZone: string;
  onCurrencyChange: (next: string) => void;
  onTimeZoneChange: (next: string) => void;
}

export function SetupBooksFields({
  currency,
  currencyError,
  timeZone,
  onCurrencyChange,
  onTimeZoneChange,
}: SetupBooksFieldsProps) {
  const t = useT();
  const { tag } = useAppLocaleState();

  const currencies = useMemo(
    () => currencyChoices(tag, t("setup.currency.regionDefault")),
    [tag, t],
  );
  const zones = useMemo(
    () => timeZoneChoices(t("setup.timeZone.regionDefault"), timeZone),
    [t, timeZone],
  );

  function handleCurrencyChange(next: string | string[] | null) {
    if (typeof next === "string") onCurrencyChange(next);
  }

  function handleTimeZoneChange(next: string | string[] | null) {
    if (typeof next === "string") onTimeZoneChange(next);
  }

  return (
    <>
      <Field>
        <FieldLabel>{t("setup.booksName")}</FieldLabel>
        <TextField
          name="books_name"
          maxLength={80}
          autoComplete="off"
          placeholder={t("setup.booksName.placeholder")}
        />
        <FieldDescription>{t("setup.booksName.help")}</FieldDescription>
      </Field>

      <Field {...(currencyError === undefined ? {} : { invalid: true })}>
        <FieldLabel>{t("setup.currency")}</FieldLabel>
        <ChoiceSelect
          label={t("setup.currency")}
          choices={currencies}
          value={currency}
          multiple={false}
          invalid={currencyError !== undefined}
          className={widths.medium}
          onChange={handleCurrencyChange}
        />
        {currencyError !== undefined && (
          <FieldError>{currencyError}</FieldError>
        )}
        <FieldDescription>{t("setup.currency.help")}</FieldDescription>
      </Field>

      <Field necessity="none">
        <FieldLabel>{t("settings.timeZone")}</FieldLabel>
        <ChoiceSelect
          label={t("settings.timeZone")}
          choices={zones}
          value={timeZone}
          multiple={false}
          onChange={handleTimeZoneChange}
        />
        <FieldDescription>{t("settings.timeZone.help")}</FieldDescription>
      </Field>
    </>
  );
}
