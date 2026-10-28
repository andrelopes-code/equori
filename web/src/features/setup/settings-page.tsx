import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useSearch } from "@tanstack/react-router";

import { SettingsNavigation } from "@/features/setup/settings-navigation";
import { SettingsPane } from "@/features/setup/settings-pane";
import styles from "@/features/setup/settings-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// One pane at a time beside the grouped navigation. On a phone the navigation is the page's index
// and a pane takes the whole width, with the way back to the index in the top bar.
export function SettingsPage() {
  const t = useT();
  const { section } = useSearch({ from: "/_authed/settings" });
  const compact = useMediaQuery(compactQuery);
  const current = section ?? (compact ? null : "account");
  // On a phone an open pane is the page: it draws the header and the body, and the top bar holds
  // the way back.
  if (compact && current !== null)
    return (
      <Page width="full">
        <SettingsPane topic={current} />
      </Page>
    );
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("more.settings")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("settings.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {compact ? (
          <SettingsNavigation current={null} index />
        ) : (
          <div className={styles.layout}>
            <div className={styles.navigation}>
              <SettingsNavigation current={current} index={false} />
            </div>
            <div className={styles.content}>
              <SettingsPane key={current} topic={current ?? "account"} />
            </div>
          </div>
        )}
      </PageBody>
    </Page>
  );
}
