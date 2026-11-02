import { useChooseLanguage } from "@/features/session";
import { SettingsExample } from "@/features/setup/settings-example";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { languages } from "@/i18n/languages";
import { ChoiceSelect } from "@/ui/choice-select";
import type { Choice } from "@/ui/choice-select";

const languageChoices: readonly Choice[] = languages.map((l) => ({
  value: l.language,
  label: l.nativeName,
}));

export function SettingsLanguage() {
  const t = useT();
  const { language } = useAppLocaleState();
  const chooseLanguage = useChooseLanguage();

  return (
    <>
      <SettingsGroup
        title={t("settings.language.title")}
        description={t("settings.language.description")}
      >
        <SettingsRow
          label={t("settings.language")}
          description={t("settings.language.help")}
        >
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
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup
        title={t("settings.language.example")}
        description={t("settings.language.exampleDescription")}
      >
        <SettingsExample />
      </SettingsGroup>
    </>
  );
}
