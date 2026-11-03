import { SettingsLanguage } from "@/features/setup/settings-language";
import { SettingsPrivacy } from "@/features/setup/settings-privacy";
import { SettingsSection } from "@/features/setup/settings-section";
import { SettingsThemeCard } from "@/features/setup/settings-theme-card";
import { useT } from "@/i18n/i18n-provider";

// The appearance lives in a studio of its own, at the full width of the page (spec A7).
export function SettingsAppearance() {
  const t = useT();

  return (
    <SettingsSection
      topic="appearance"
      title={t("settings.appearance.title")}
      description={t("settings.summary.appearance")}
    >
      <SettingsThemeCard />
      <SettingsLanguage />
      <SettingsPrivacy />
    </SettingsSection>
  );
}
