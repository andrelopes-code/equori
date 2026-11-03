import { ThemeScope } from "@slotted/react/theme";
import type { CSSProperties } from "react";

import styles from "@/features/setup/theme-miniature.module.css";
import { useT } from "@/i18n/i18n-provider";
import { accentSeed } from "@/theme/accent";
import { statusNames } from "@/theme/status";
import { surfaceAttributes } from "@/theme/surface";
import type { ThemeValues } from "@/theme/themes";
import { toneSeed } from "@/theme/tone";
import { typefaceStack } from "@/theme/typeface";

export interface ThemeMiniatureProps {
  values: ThemeValues;
}

const palette = ["accent", "success", "danger", "warning", "info"] as const;

// Families read: none draws a miniature of the application. The scope derives every token again
// from the theme's seeds, corners and surface values, so the drawing is the theme and not a copy
// of its colours. The canvas shows its tone, the specimen its face, the dots its palette, and the
// panel its corners, edge, shadow and the two weights of action.
export function ThemeMiniature({ values }: ThemeMiniatureProps) {
  const t = useT();

  const seeds = miniatureSeeds(values);
  const surfaces = surfaceAttributes(values);
  const face = {
    "--slotted-font-family-sans": typefaceStack(values.typeface),
  } as CSSProperties;

  return (
    <ThemeScope
      corners={values.corners}
      seeds={seeds}
      style={face}
      className={styles.miniature}
      data-visual={values.visual}
      {...surfaces}
    >
      <span className={styles.head}>
        <span className={styles.specimen}>{t("settings.typeface.sample")}</span>
        <span className={styles.palette}>
          {palette.map((tone) => (
            <span key={tone} className={styles.dot} data-tone={tone} />
          ))}
        </span>
      </span>

      <span className={styles.panel}>
        <span className={styles.label} />
        <span className={styles.flows}>
          <span className={styles.income} />
          <span className={styles.expense} />
        </span>
        <span className={styles.actions}>
          <span className={styles.primary} />
          <span className={styles.secondary} />
        </span>
      </span>
    </ThemeScope>
  );
}

function miniatureSeeds(values: ThemeValues): Record<string, string> {
  const seeds: Record<string, string> = {
    accent: accentSeed(values.accent),
    neutral: toneSeed(values.tone),
  };
  for (const name of statusNames) {
    const seed = values[name];
    if (seed !== "theme") seeds[name] = seed;
  }

  return seeds;
}
