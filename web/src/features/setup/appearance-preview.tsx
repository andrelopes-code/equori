import { Button } from "@slotted/react/button";
import { Switch } from "@slotted/react/switch";
import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";
import { useState } from "react";

import styles from "@/features/setup/settings-page.module.css";
import { useT } from "@/i18n/i18n-provider";

// Families read: button, tag, switch, typography. The preview is those families themselves under
// the choices in force, not a drawing of them, so it changes the moment a choice does.
export function AppearancePreview() {
  const t = useT();
  const [on, setOn] = useState(true);
  return (
    <div
      className={styles.preview}
      aria-label={t("settings.preview")}
      role="group"
    >
      <div>
        <Heading level={4} size="lg">
          {t("settings.preview.heading")}
        </Heading>
        <Text size="sm" tone="muted">
          {t("settings.preview.body")}
        </Text>
      </div>
      <div className={styles.previewRow}>
        <Button>{t("settings.preview.primary")}</Button>
        <Button variant="outline" tone="secondary">
          {t("settings.preview.secondary")}
        </Button>
        <Button variant="ghost" tone="secondary">
          {t("settings.preview.tertiary")}
        </Button>
      </div>
      <div className={styles.previewRow}>
        <Tag tone="accent">{t("settings.preview.accent")}</Tag>
        <Tag tone="success">{t("settings.preview.success")}</Tag>
        <Tag tone="warning">{t("settings.preview.warning")}</Tag>
        <Tag tone="danger">{t("settings.preview.danger")}</Tag>
      </div>
      <Switch checked={on} onCheckedChange={setOn}>
        {t("settings.preview.switch")}
      </Switch>
    </div>
  );
}
