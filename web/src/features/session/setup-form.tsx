import { Button } from "@slotted/react/button";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import type { FormErrors } from "@slotted/react/form";
import { useMemo, useState } from "react";

import { UpdateCheckChoice } from "@/features/instance";
import styles from "@/features/session/login-page.module.css";
import { regionFromLanguage } from "@/features/session/region-from-language";
import { SetupAccountFields } from "@/features/session/setup-account-fields";
import { SetupBooksFields } from "@/features/session/setup-books-fields";
import { useSetupSubmit } from "@/features/session/use-setup-submit";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { languages, matchLanguage } from "@/i18n/languages";
import type { Language } from "@/i18n/languages";
import { regionChoicesFor } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormNotice } from "@/ui/form-notice";
import { FormLayout } from "@/ui/form-layout";
import { FormSection } from "@/ui/form-section";

interface SetupFormProps {
  token: string;
}

export function SetupForm({ token }: SetupFormProps) {
  const t = useT();
  const { tag } = useAppLocaleState();
  // The language is a choice among the catalogs, the region a choice among the assigned codes:
  // both are one pick from a fixed list, which a select answers in one step.
  const [language, setLanguage] = useState<Language>(() =>
    matchLanguage(navigator.languages),
  );
  const [region, setRegion] = useState<string | null>(() =>
    regionFromLanguage(navigator.language),
  );
  const [currency, setCurrency] = useState("");
  const [timeZone, setTimeZone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [updateCheck, setUpdateCheck] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const { submit, failure, pending } = useSetupSubmit({
    token,
    language,
    region,
    currency,
    timeZone,
    updateCheck,
  });

  const languageChoices = useMemo(
    () => languages.map((l) => ({ value: l.language, label: l.nativeName })),
    [],
  );
  const regionChoices = useMemo(() => regionChoicesFor(tag), [tag]);

  const regionError = errors.region;
  const currencyError = errors.base_currency?.join(" ");
  const updateCheckError = errors.update_check?.join(" ");

  function handleLanguageChange(next: string | string[] | null) {
    const chosen = languages.find((l) => l.language === next);
    if (chosen !== undefined) setLanguage(chosen.language);
  }

  function handleRegionChange(next: string | string[] | null) {
    if (typeof next === "string") setRegion(next);
    clearError("region");
  }

  function handleCurrencyChange(next: string) {
    setCurrency(next);
    clearError("base_currency");
  }

  function handleUpdateCheckChange(value: boolean) {
    setUpdateCheck(value);
    clearError("update_check");
  }

  function clearError(key: string) {
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)),
    );
  }

  return (
    <Form
      onSubmit={submit}
      errors={errors}
      onErrorsChange={setErrors}
      loading={pending}
    >
      <FormLayout>
        <SetupAccountFields />

        <FormSection legend={t("setup.section.place")}>
          <Field required>
            <FieldLabel>{t("setup.language")}</FieldLabel>
            <ChoiceSelect
              label={t("setup.language")}
              choices={languageChoices}
              value={language}
              multiple={false}
              onChange={handleLanguageChange}
            />
          </Field>

          <Field
            required
            {...(regionError === undefined ? {} : { invalid: true })}
          >
            <FieldLabel>{t("setup.region")}</FieldLabel>
            <ChoiceSelect
              label={t("setup.region")}
              choices={regionChoices}
              value={region}
              multiple={false}
              placeholder={t("setup.region.placeholder")}
              invalid={regionError !== undefined}
              onChange={handleRegionChange}
            />
            {regionError !== undefined && (
              <FieldError>{regionError.join(" ")}</FieldError>
            )}
          </Field>
        </FormSection>

        <FormSection legend={t("setup.section.books")}>
          <SetupBooksFields
            currency={currency}
            currencyError={currencyError}
            timeZone={timeZone}
            onCurrencyChange={handleCurrencyChange}
            onTimeZoneChange={setTimeZone}
          />
        </FormSection>

        <FormSection legend={t("setup.section.updates")}>
          <UpdateCheckChoice
            value={updateCheck}
            {...(updateCheckError === undefined
              ? {}
              : { error: updateCheckError })}
            onChange={handleUpdateCheckChange}
          />
        </FormSection>
      </FormLayout>

      {failure !== null && (
        <FormNotice className={styles.failure}>{failure}</FormNotice>
      )}

      <FormActions align="stretch">
        <Button type="submit" fullWidth loading={pending}>
          {t("setup.submit")}
        </Button>
      </FormActions>
    </Form>
  );
}
