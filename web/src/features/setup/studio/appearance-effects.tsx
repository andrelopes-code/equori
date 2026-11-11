import { Inline } from "@slotted/react/inline";
import { Switch } from "@slotted/react/switch";
import { Tag } from "@slotted/react/tag";

import { StudioSection } from "@/features/setup/studio/studio-section";
import { useT } from "@/i18n/i18n-provider";
import { useMotion } from "@/theme/motion";
import { useVisual } from "@/theme/visual";

export function AppearanceEffects() {
  const t = useT();
  const [motion, setMotion] = useMotion();
  const [visual, setVisual] = useVisual();

  // The trailing space keeps the switch's accessible name "Glass surfaces Experimental".
  const glassLabel = `${t("settings.experimental.glass")} `;

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
        <Inline align="center" gap={4}>
          {glassLabel}
          <Tag size="sm" tone="accent" variant="solid">
            {t("settings.experimental.tag")}
          </Tag>
        </Inline>
      </Switch>
    </StudioSection>
  );
}
