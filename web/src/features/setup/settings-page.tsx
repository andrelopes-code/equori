import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { TableOfContents } from "@slotted/react/table-of-contents";

import { SettingsAccount } from "@/features/setup/settings-account";
import { SettingsAppearance } from "@/features/setup/settings-appearance";
import { SettingsAssistant } from "@/features/setup/settings-assistant";
import { SettingsLanguage } from "@/features/setup/settings-language";
import { SettingsLedger } from "@/features/setup/settings-ledger";
import { SettingsPrivacy } from "@/features/setup/settings-privacy";
import styles from "@/features/setup/settings-page.module.css";
import { settingsTopics } from "@/features/setup/settings-topics";
import { useT } from "@/i18n/i18n-provider";

export function SettingsPage() {
  const t = useT();
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
        <div className={styles.frame}>
          <div className={styles.layout}>
            <div className={styles.contents}>
              <TableOfContents
                label={t("settings.contents")}
                history="replace"
                items={settingsTopics.map((topic) => ({
                  id: topic.id,
                  label: t(topic.title),
                }))}
              />
            </div>
            <div className={styles.sections}>
              <SettingsAccount />
              <SettingsAppearance />
              <SettingsLanguage />
              <SettingsPrivacy />
              <SettingsLedger />
              <SettingsAssistant />
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
