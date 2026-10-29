import { CornersPreview } from "@/features/setup/corners-preview";
import { DensityPreview } from "@/features/setup/density-preview";
import { oneOf } from "@/features/setup/one-of";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { useT } from "@/i18n/i18n-provider";
import { cornerStyles, useCorners } from "@/theme/corners";
import { densities, useDensity } from "@/theme/density";
import { ChoiceCards } from "@/ui/choice-cards";

export function AppearanceShape() {
  const t = useT();
  const [corners, setCorners] = useCorners();
  const [density, setDensity] = useDensity();

  return (
    <SettingsGroup title={t("settings.appearance.shape")}>
      <SettingsRow
        label={t("settings.corners")}
        description={t("settings.corners.description")}
        stacked
      >
        <ChoiceCards
          name="corners"
          label={t("settings.corners")}
          value={corners}
          choices={cornerStyles.map((c) => ({
            value: c,
            label: t(`corners.${c}`),
            preview: <CornersPreview corners={c} />,
          }))}
          onChange={(next) => {
            if (oneOf(cornerStyles, next)) setCorners(next);
          }}
        />
      </SettingsRow>
      <SettingsRow
        label={t("more.density")}
        description={t("settings.density.description")}
        stacked
      >
        <ChoiceCards
          name="density"
          label={t("more.density")}
          value={density}
          choices={densities.map((d) => ({
            value: d,
            label: t(`density.${d}`),
            preview: <DensityPreview density={d} />,
          }))}
          onChange={(next) => {
            if (oneOf(densities, next)) setDensity(next);
          }}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
