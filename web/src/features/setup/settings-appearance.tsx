import { ButtonLink } from "@slotted/react/button";

import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { SettingsSection } from "@/features/setup/settings-section";
import { useThemeLibrary } from "@/features/setup/use-theme-library";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

// The appearance lives in a studio of its own, at the full width of the page (spec A7).
export function SettingsAppearance() {
  const t = useT();
  const library = useThemeLibrary();

  return (
    <SettingsSection
      topic="appearance"
      title={t("settings.appearance.title")}
      description={t("settings.summary.appearance")}
      local
    >
      <SettingsGroup>
        <SettingsRow
          label={library.activeName ?? t("settings.theme.custom")}
          description={t("settings.appearance.openHint")}
        >
          <ButtonLink render={routeTo({ to: "/settings/appearance" })}>
            {t("settings.appearance.open")}
          </ButtonLink>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
