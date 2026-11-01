import { Button } from "@slotted/react/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import type { FormErrors } from "@slotted/react/form";
import { InlineMessage } from "@slotted/react/inline-message";
import { TextField } from "@slotted/react/text-field";
import { useMemo, useState } from "react";

import { UpdateCheckChoice } from "@/features/instance";
import styles from "@/features/session/login-page.module.css";
import { regionFromLanguage } from "@/features/session/region-from-language";
import { SetupBooksFields } from "@/features/session/setup-books-fields";
import { useSetupSubmit } from "@/features/session/use-setup-submit";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { languages, matchLanguage } from "@/i18n/languages";
import type { Language } from "@/i18n/languages";
import { regionChoicesFor } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";

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
  const [timeZone, setTimeZone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [updateCheck, setUpdateCheck] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const { submit, failure, pending } = useSetupSubmit({
    token,
    language,
    region,
    timeZone,
    updateCheck,
  });

  const languageChoices = useMemo(
    () => languages.map((l) => ({ value: l.language, label: l.nativeName })),
    [],
  );
  const regionChoices = useMemo(() => regionChoicesFor(tag), [tag]);

  const regionError = errors.region;
  const updateCheckError = errors.update_check?.join(" ");

  function handleLanguageChange(next: string | string[] | null) {
    const chosen = languages.find((l) => l.language === next);
    if (chosen !== undefined) setLanguage(chosen.language);
  }

  function handleRegionChange(next: string | string[] | null) {
    if (typeof next === "string") setRegion(next);
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => k !== "region")),
    );
  }

  function handleUpdateCheckChange(value: boolean) {
    setUpdateCheck(value);
    setErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([k]) => k !== "update_check"),
      ),
    );
  }

  return (
    <Form
      onSubmit={submit}
      errors={errors}
      onErrorsChange={setErrors}
      loading={pending}
    >
      <Field required>
        <FieldLabel>{t("setup.email")}</FieldLabel>
        <TextField
          name="email"
          type="email"
          size="lg"
          autoComplete="username"
        />
      </Field>

      <Field required>
        <FieldLabel>{t("setup.password")}</FieldLabel>
        <TextField
          name="password"
          type="password"
          size="lg"
          revealable
          autoComplete="new-password"
        />
        <FieldDescription>{t("setup.password.help")}</FieldDescription>
      </Field>

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

      <Field required {...(regionError === undefined ? {} : { invalid: true })}>
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

      <Field>
        <FieldLabel>{t("setup.currency")}</FieldLabel>
        <TextField
          name="base_currency"
          size="lg"
          maxLength={3}
          autoComplete="off"
        />
        <FieldDescription>{t("setup.currency.help")}</FieldDescription>
      </Field>

      <SetupBooksFields timeZone={timeZone} onTimeZoneChange={setTimeZone} />

      <UpdateCheckChoice
        value={updateCheck}
        {...(updateCheckError === undefined ? {} : { error: updateCheckError })}
        onChange={handleUpdateCheckChange}
      />

      {failure !== null && (
        <InlineMessage
          tone="danger"
          live="assertive"
          size="md"
          className={styles.failure}
        >
          {failure}
        </InlineMessage>
      )}

      <FormActions align="stretch">
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {t("setup.submit")}
        </Button>
      </FormActions>
    </Form>
  );
}
