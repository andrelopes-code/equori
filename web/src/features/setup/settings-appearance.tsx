import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Heading, Text } from "@slotted/react/typography";

import { AppearanceColour } from "@/features/setup/appearance-colour";
import { AppearanceEffects } from "@/features/setup/appearance-effects";
import { AppearancePreview } from "@/features/setup/appearance-preview";
import { AppearanceShape } from "@/features/setup/appearance-shape";
import { AppearanceText } from "@/features/setup/appearance-text";
import { AppearanceToolbar } from "@/features/setup/appearance-toolbar";
import styles from "@/features/setup/settings-appearance.module.css";
import { oneOf } from "@/features/setup/one-of";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { SettingsSection } from "@/features/setup/settings-section";
import { ThemeGallery } from "@/features/setup/theme-gallery";
import { useThemeLibrary } from "@/features/setup/use-theme-library";
import { useT } from "@/i18n/i18n-provider";
import { resetAppearance } from "@/theme/appearance";
import { schemes, useScheme } from "@/theme/scheme";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// The theme first, then the controls that refine it beside a preview of their result
// (docs/specs/2026-10-29-appearance-studio-design.md, A7).
export function SettingsAppearance() {
  const t = useT();
  const library = useThemeLibrary();
  const [scheme, setScheme] = useScheme();
  // A phone's width cuts the longest scheme name in a row of four; the segments stack there.
  const compact = useMediaQuery(compactQuery);

  return (
    <SettingsSection
      topic="appearance"
      title={t("settings.appearance.title")}
      description={t("settings.summary.appearance")}
      local
    >
      <AppearanceToolbar library={library} />

      <SettingsGroup title={t("settings.appearance.theme")}>
        <SettingsRow
          label={t("more.scheme")}
          description={t("settings.scheme.description")}
          stacked
        >
          <SegmentedControl
            aria-label={t("more.scheme")}
            orientation={compact ? "vertical" : "horizontal"}
            value={scheme}
            onValueChange={(next) => {
              if (oneOf(schemes, next)) setScheme(next);
            }}
          >
            {schemes.map((s) => (
              <Segment key={s} value={s}>
                {t(`scheme.${s}`)}
              </Segment>
            ))}
          </SegmentedControl>
        </SettingsRow>
        <ThemeGallery
          saved={library.saved}
          active={library.active}
          onChoose={library.choose}
        />
      </SettingsGroup>

      <div className={styles.tuningHeader}>
        <Heading level={3} size="md">
          {t("settings.appearance.tuning")}
        </Heading>
        <Text size="sm" tone="muted">
          {t("settings.appearance.tuningHint")}
        </Text>
      </div>

      <div className={styles.tuning}>
        <div className={styles.editor}>
          <AppearanceColour />
          <AppearanceShape />
          <AppearanceText />
          <AppearanceEffects />
        </div>
        <div className={styles.preview}>
          <AppearancePreview />
        </div>
      </div>

      <Inline justify="end">
        <Button variant="ghost" tone="secondary" onClick={resetAppearance}>
          {t("settings.appearance.reset")}
        </Button>
      </Inline>
    </SettingsSection>
  );
}
