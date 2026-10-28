import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/setup/settings-page.module.css";
import type { SettingsTopic } from "@/features/setup/settings-topics";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// One pane of the settings page: its title, what it holds, and its groups. local marks a pane whose
// choices stay in this browser rather than in the account.
export function SettingsSection({
  topic,
  title,
  description,
  local = false,
  children,
}: {
  topic: SettingsTopic;
  title: string;
  description?: string;
  local?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const heading = `settings-${topic}`;
  // On a phone the pane is the page, so its title is the page's.
  const compact = useMediaQuery(compactQuery);
  return (
    <section id={topic} aria-labelledby={heading} className={styles.pane}>
      <header className={styles.paneHeader}>
        <div className={styles.paneTitle}>
          <Heading level={compact ? 1 : 2} size="2xl" id={heading}>
            {title}
          </Heading>
          {local && (
            <Tag size="sm" tone="secondary">
              {t("settings.browserOnly.tag")}
            </Tag>
          )}
        </div>
        {description !== undefined && (
          <Text size="md" tone="muted">
            {description}
          </Text>
        )}
      </header>
      {children}
    </section>
  );
}
