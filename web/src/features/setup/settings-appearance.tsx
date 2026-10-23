import { Switch } from "@slotted/react/switch";

import { AccentSwatches } from "@/features/setup/accent-swatches";
import { CornersPreview } from "@/features/setup/corners-preview";
import { DensityPreview } from "@/features/setup/density-preview";
import { SchemePreview } from "@/features/setup/scheme-preview";
import { SettingsSection } from "@/features/setup/settings-section";
import styles from "@/features/setup/settings-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { cornerStyles, useCorners } from "@/theme/corners";
import type { Corners } from "@/theme/corners";
import { densities, useDensity } from "@/theme/density";
import type { Density } from "@/theme/density";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";
import { useVisual } from "@/theme/visual";
import { ChoiceCards } from "@/ui/choice-cards";

const schemes: readonly Scheme[] = ["dark", "light", "system"];

function isScheme(value: string): value is Scheme {
  return (schemes as readonly string[]).includes(value);
}

function isDensity(value: string): value is Density {
  return (densities as readonly string[]).includes(value);
}

function isCorners(value: string): value is Corners {
  return (cornerStyles as readonly string[]).includes(value);
}

export function SettingsAppearance() {
  const t = useT();
  const [scheme, setScheme] = useScheme();
  const [density, setDensity] = useDensity();
  const [corners, setCorners] = useCorners();
  const [visual, setVisual] = useVisual();
  return (
    <SettingsSection
      topic="appearance"
      title={t("settings.appearance.title")}
      description={t("settings.browserOnly")}
    >
      <div className={styles.groups}>
        <div className={styles.choice}>
          <h3 className={styles.legend}>{t("more.scheme")}</h3>
          <ChoiceCards
            name="scheme"
            label={t("more.scheme")}
            value={scheme}
            choices={schemes.map((s) => ({
              value: s,
              label: t(`scheme.${s}`),
              preview: <SchemePreview scheme={s} />,
            }))}
            onChange={(next) => {
              if (isScheme(next)) setScheme(next);
            }}
          />
        </div>
        <div className={styles.choice}>
          <h3 className={styles.legend}>{t("settings.accent")}</h3>
          <p className={styles.hint}>{t("settings.accent.description")}</p>
          <AccentSwatches label={t("settings.accent")} />
        </div>
        <div className={styles.choice}>
          <h3 className={styles.legend}>{t("settings.corners")}</h3>
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
              if (isCorners(next)) setCorners(next);
            }}
          />
        </div>
        <div className={styles.choice}>
          <h3 className={styles.legend}>{t("more.density")}</h3>
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
              if (isDensity(next)) setDensity(next);
            }}
          />
        </div>
        <div className={styles.choice}>
          <h3 className={styles.legend}>{t("settings.experimental.title")}</h3>
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
        </div>
      </div>
    </SettingsSection>
  );
}
