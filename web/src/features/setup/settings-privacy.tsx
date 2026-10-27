import { Switch } from "@slotted/react/switch";

import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";

export function SettingsPrivacy() {
  const t = useT();
  const { hidden, setHidden } = usePrivacy();
  return (
    <SettingsSection
      topic="privacy"
      title={t("settings.privacy.title")}
      description={t("settings.summary.privacy")}
      local
    >
      <SettingsGroup>
        <Switch
          labelPlacement="start"
          checked={hidden}
          onCheckedChange={setHidden}
          description={t("settings.privacy.description")}
        >
          {t("privacy.hide")}
        </Switch>
      </SettingsGroup>
    </SettingsSection>
  );
}
