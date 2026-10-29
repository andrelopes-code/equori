import { ThemeScope } from "@slotted/react/theme";
import type { CSSProperties } from "react";

import styles from "@/features/setup/theme-miniature.module.css";
import { useT } from "@/i18n/i18n-provider";
import { accentSeed } from "@/theme/accent";
import { statusNames } from "@/theme/status";
import type { ThemeValues } from "@/theme/themes";
import { toneSeed } from "@/theme/tone";
import { typefaceStack } from "@/theme/typeface";

export interface ThemeMiniatureProps {
  values: ThemeValues;
}

// Families read: none draws a miniature of the application. The scope derives every token again
// from the theme's seeds and corners, so the drawing is the theme and not a copy of its colours.
export function ThemeMiniature({ values }: ThemeMiniatureProps) {
  const t = useT();

  const seeds = miniatureSeeds(values);
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
    >
      <span className={styles.rail}>
        <span className={styles.brand} />
        <span className={styles.navCurrent} />
        <span className={styles.nav} />
        <span className={styles.nav} />
      </span>

      <span className={styles.main}>
        <span className={styles.sample}>{t("settings.typeface.sample")}</span>
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
