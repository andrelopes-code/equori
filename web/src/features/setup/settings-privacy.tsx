import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Switch } from "@slotted/react/switch";

import { SettingsGroup } from "@/features/setup/settings-group";
import { useT } from "@/i18n/i18n-provider";
import { privacyAutos, usePrivacy } from "@/privacy/privacy-provider";

export function SettingsPrivacy() {
  const t = useT();
  const { hidden, setHidden, auto, setAuto } = usePrivacy();
  return (
    <SettingsGroup title={t("settings.privacy.title")}>
      <Switch
        labelPlacement="start"
        checked={hidden}
        onCheckedChange={setHidden}
        description={t("settings.privacy.description")}
      >
        {t("privacy.hide")}
      </Switch>

      <RadioGroup
        aria-label={t("settings.privacy.auto")}
        value={auto}
        onValueChange={(next) => {
          setAuto(privacyAutos.find((value) => value === next) ?? "never");
        }}
      >
        {privacyAutos.map((value) => (
          <Radio key={value} value={value}>
            {t(`settings.privacy.auto.${value}`)}
          </Radio>
        ))}
      </RadioGroup>
    </SettingsGroup>
  );
}
