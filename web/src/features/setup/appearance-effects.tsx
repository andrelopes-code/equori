import { Switch } from "@slotted/react/switch";

import { StudioSection } from "@/features/setup/studio-section";
import { useT } from "@/i18n/i18n-provider";
import { useMotion } from "@/theme/motion";
import { useVisual } from "@/theme/visual";

export function AppearanceEffects() {
  const t = useT();
  const [motion, setMotion] = useMotion();
  const [visual, setVisual] = useVisual();

  return (
    <StudioSection title={t("settings.appearance.motion")}>
      <Switch
        labelPlacement="start"
        checked={motion === "reduced"}
        onCheckedChange={(on) => {
          setMotion(on ? "reduced" : "system");
        }}
        description={t("settings.motion.description")}
      >
        {t("settings.motion")}
      </Switch>
      <Switch
        labelPlacement="start"
        checked={visual === "glass"}
        onCheckedChange={(on) => {
          setVisual(on ? "glass" : "standard");
        }}
        description={t("settings.experimental.glassDescription")}
      >
        {t("settings.experimental.glass")}
      </Switch>
    </StudioSection>
  );
}
