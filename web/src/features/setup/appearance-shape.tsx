import { StudioChoice } from "@/features/setup/studio-choice";
import { StudioSection } from "@/features/setup/studio-section";
import { useT } from "@/i18n/i18n-provider";
import { cornerStyles, useCorners } from "@/theme/corners";
import { densities, useDensity } from "@/theme/density";

export function AppearanceShape() {
  const t = useT();
  const [corners, setCorners] = useCorners();
  const [density, setDensity] = useDensity();

  return (
    <StudioSection title={t("settings.appearance.shape")}>
      <StudioChoice
        label={t("settings.corners")}
        hint={t("settings.corners.description")}
        values={cornerStyles}
        value={corners}
        text={(c) => t(`corners.${c}`)}
        onChange={setCorners}
      />
      <StudioChoice
        label={t("more.density")}
        hint={t("settings.density.description")}
        values={densities}
        value={density}
        text={(d) => t(`density.${d}`)}
        onChange={setDensity}
      />
    </StudioSection>
  );
}
