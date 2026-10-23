import { Field, FieldLabel } from "@slotted/react/field";
import { useMemo } from "react";

import { useChooseLanguage } from "@/features/session";
import { useChooseRegion } from "@/features/setup/api";
import { SettingsExample } from "@/features/setup/settings-example";
import { SettingsSection } from "@/features/setup/settings-section";
import styles from "@/features/setup/settings-page.module.css";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { languages } from "@/i18n/languages";
import { regions } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";
import type { Choice } from "@/ui/choice-select";

const languageChoices: readonly Choice[] = languages.map((l) => ({
  value: l.language,
  label: l.nativeName,
}));

export function SettingsLanguage() {
  const t = useT();
  const { tag, language, locale } = useAppLocaleState();
  const chooseLanguage = useChooseLanguage();
  const chooseRegion = useChooseRegion();

  const regionChoices = useMemo(() => {
    const names = new Intl.DisplayNames([tag], { type: "region" });
    return regions
      .map((code) => ({ value: code, label: names.of(code) ?? code }))
      .sort((a, b) => a.label.localeCompare(b.label, tag));
  }, [tag]);

  return (
    <SettingsSection
      topic="language"
      title={t("settings.language.title")}
      description={t("settings.language.description")}
    >
      <div className={styles.fields}>
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
        <SettingsExample />
      </div>
    </SettingsSection>
  );
}
