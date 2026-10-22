import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, problemMessage } from "@/api/problem";
import {
  instrumentsQuery,
  settingsQuery,
  useChooseRegion,
  useUpdateSettings,
} from "@/features/setup/api";
import { useChooseLanguage } from "@/features/session";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { languages } from "@/i18n/languages";
import { regions } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";
import type { Choice } from "@/ui/choice-select";

const languageChoices: readonly Choice[] = languages.map((l) => ({
  value: l.language,
  label: l.nativeName,
}));

export function SettingsPage() {
  const t = useT();
  const api = useApi();
  const { tag, language, locale } = useAppLocaleState();
  const chooseLanguage = useChooseLanguage();
  const chooseRegion = useChooseRegion();
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const update = useUpdateSettings();

  const regionChoices = useMemo(() => {
    const names = new Intl.DisplayNames([tag], { type: "region" });
    return regions
      .map((code) => ({ value: code, label: names.of(code) ?? code }))
      .sort((a, b) => a.label.localeCompare(b.label, tag));
  }, [tag]);

  const currencyChoices = useMemo(
    () =>
      (instruments.data?.items ?? [])
        .filter((i) => i.type === "currency")
        .map((i) => ({ value: i.code, label: `${i.code} ${i.name}` })),
    [instruments.data],
  );

  const currencyError =
    update.error instanceof ProblemError
      ? problemMessage(update.error.problem, t)
      : undefined;

  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("more.settings")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={4}>
          <Field>
            <FieldLabel>{t("settings.language")}</FieldLabel>
            <ChoiceSelect
              label={t("settings.language")}
              choices={languageChoices}
              value={language}
              multiple={false}
              onChange={(next) => {
                const chosen = languages.find((l) => l.language === next);
                if (chosen !== undefined) chooseLanguage(chosen.language);
              }}
            />
          </Field>
          <Field>
            <FieldLabel>{t("settings.region")}</FieldLabel>
            <ChoiceSelect
              label={t("settings.region")}
              choices={regionChoices}
              value={locale.region}
              multiple={false}
              onChange={(next) => {
                if (typeof next === "string") chooseRegion(next);
              }}
            />
          </Field>
          <Field invalid={currencyError !== undefined}>
            <FieldLabel>{t("settings.baseCurrency")}</FieldLabel>
            <ChoiceSelect
              label={t("settings.baseCurrency")}
              choices={currencyChoices}
              value={settings.data?.base_currency ?? null}
              multiple={false}
              invalid={currencyError !== undefined}
              onChange={(next) => {
                if (typeof next === "string") {
                  update.mutate({ base_currency: next });
                }
              }}
            />
            {currencyError !== undefined && (
              <FieldError>{currencyError}</FieldError>
            )}
          </Field>
        </Stack>
      </PageBody>
    </Page>
  );
}
