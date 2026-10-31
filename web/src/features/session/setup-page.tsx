import { useRouter, useRouterState } from "@tanstack/react-router";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
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
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Heading, Text } from "@slotted/react/typography";
import { useEffect, useMemo, useState } from "react";

import { UpdateCheckChoice } from "@/features/instance";
import styles from "@/features/session/login-page.module.css";
import { useSetupSubmit } from "@/features/session/use-setup-submit";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { languages, matchLanguage } from "@/i18n/languages";
import type { Language } from "@/i18n/languages";
import { regionChoicesFor } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";

// The token arrives in the fragment of the address serve printed (W-U1, W-U6 of the Windows
// design); the page reads it once and takes it out of the address bar and the history.
function tokenOf(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? "";
}

// The first-user screen shares the login's measure and form area: both stand before a session.
export function SetupPage() {
  const t = useT();
  const router = useRouter();
  const { tag } = useAppLocaleState();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const [token] = useState(() => tokenOf(hash));
  // The language is a choice among the catalogs, the region a choice among the assigned codes:
  // both are one pick from a fixed list, which a select answers in one step.
  const [language, setLanguage] = useState<Language>(() =>
    matchLanguage(navigator.languages),
  );
  const [region, setRegion] = useState<string | null>(null);
  const [updateCheck, setUpdateCheck] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const { submit, failure, pending } = useSetupSubmit({
    token,
    language,
    region,
    updateCheck,
  });

  useEffect(() => {
    if (hash !== "")
      void router.navigate({ to: "/setup", hash: "", replace: true });
  }, [hash, router]);

  const languageChoices = useMemo(
    () => languages.map((l) => ({ value: l.language, label: l.nativeName })),
    [],
  );
  const regionChoices = useMemo(() => regionChoicesFor(tag), [tag]);

  const regionError = errors.region;
  const updateCheckError = errors.update_check?.join(" ");

  function handleUpdateCheckChange(value: boolean) {
    setUpdateCheck(value);
    setErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([k]) => k !== "update_check"),
      ),
    );
  }

  return (
    <Page width="content" ground="surface">
      <PageBody>
        <div className={styles.formArea}>
          <Stack gap={8} className={styles.panel}>
            <Stack gap={2}>
              <Heading level={1} size="2xl">
                {t("setup.title")}
              </Heading>
              <Text tone="muted">{t("setup.subtitle")}</Text>
            </Stack>
            {token === "" ? (
              <Alert tone="warning">
                <AlertContent>
                  <AlertDescription>
                    {t("setup.token_missing")}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            ) : (
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
                  <FieldDescription>
                    {t("setup.password.help")}
                  </FieldDescription>
                </Field>
                <Field required>
                  <FieldLabel>{t("setup.language")}</FieldLabel>
                  <ChoiceSelect
                    label={t("setup.language")}
                    choices={languageChoices}
                    value={language}
                    multiple={false}
                    onChange={(next) => {
                      const chosen = languages.find((l) => l.language === next);
                      if (chosen !== undefined) setLanguage(chosen.language);
                    }}
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
                    onChange={(next) => {
                      if (typeof next === "string") setRegion(next);
                      setErrors((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).filter(([k]) => k !== "region"),
                        ),
                      );
                    }}
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
                  <FieldDescription>
                    {t("setup.currency.help")}
                  </FieldDescription>
                </Field>
                <UpdateCheckChoice
                  value={updateCheck}
                  {...(updateCheckError === undefined
                    ? {}
                    : { error: updateCheckError })}
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
            )}
          </Stack>
        </div>
      </PageBody>
    </Page>
  );
}
