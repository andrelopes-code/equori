import { Text } from "@slotted/react/typography";
import { useEffect } from "react";

import styles from "@/features/setup/theme-gallery.module.css";
import { ThemeOption } from "@/features/setup/theme-option";
import { useT } from "@/i18n/i18n-provider";
import { curatedThemeIDs, curatedThemes } from "@/theme/themes";
import type { SavedTheme, ThemeValues } from "@/theme/themes";
import { loadTypeface } from "@/theme/typeface";

export interface ThemeGalleryProps {
  saved: readonly SavedTheme[];
  active: string | null;
  onChoose: (values: ThemeValues) => void;
}

// One radio group over the curated and the saved themes, so the arrow keys move across both lists.
export function ThemeGallery({ saved, active, onChoose }: ThemeGalleryProps) {
  const t = useT();

  // Each card draws in its own face: the faces load once the gallery shows.
  useEffect(() => {
    for (const id of curatedThemeIDs) loadTypeface(curatedThemes[id].typeface);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.theme.gallery")}
      className={styles.gallery}
    >
      <Text size="sm" weight="medium" tone="muted">
        {t("settings.theme.curated")}
      </Text>
      <div className={styles.grid}>
        {curatedThemeIDs.map((id) => (
          <ThemeOption
            key={id}
            name={t(`theme.${id}`)}
            description={t(`theme.${id}.description`)}
            values={curatedThemes[id]}
            checked={active === id}
            onChoose={onChoose}
          />
        ))}
      </div>

      <Text size="sm" weight="medium" tone="muted">
        {t("settings.theme.saved")}
      </Text>
      {saved.length === 0 && (
        <Text size="sm" tone="muted">
          {t("settings.theme.savedEmpty")}
        </Text>
      )}
      {saved.length > 0 && (
        <div className={styles.grid}>
          {saved.map((theme) => (
            <ThemeOption
              key={theme.id}
              name={theme.name}
              values={theme.values}
              checked={active === theme.id}
              onChoose={onChoose}
            />
          ))}
        </div>
      )}
    </div>
  );
}
