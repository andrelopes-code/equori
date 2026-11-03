import { ButtonLink } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
import { Heading, Text } from "@slotted/react/typography";

import styles from "@/features/setup/settings-page.module.css";
import { ThemeMiniature } from "@/features/setup/theme-miniature";
import { useThemeLibrary } from "@/features/setup/use-theme-library";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

// Families read: card, button, typography. The theme in use is drawn as the application it
// styles, so the pane shows the appearance and not only the way to the studio.
export function SettingsThemeCard() {
  const t = useT();
  const library = useThemeLibrary();

  return (
    <Card>
      <CardBody>
        <div className={styles.theme}>
          <div className={styles.themeMiniature}>
            <ThemeMiniature values={library.values} />
          </div>

          <div className={styles.themeText}>
            <Text size="sm" tone="muted">
              {t("settings.appearance.active")}
            </Text>
            <Heading level={3} size="xl">
              {library.activeName ?? t("settings.theme.custom")}
            </Heading>
            <Text size="sm" tone="muted">
              {t("settings.appearance.openHint")}
            </Text>
          </div>

          <ButtonLink render={routeTo({ to: "/settings/appearance" })}>
            {t("settings.appearance.open")}
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}
