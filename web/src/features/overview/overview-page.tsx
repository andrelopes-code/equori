import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { AttentionBlock } from "@/features/overview/attention-block";
import { MonthFlowsBlock } from "@/features/overview/month-flows-block";
import { NetWorthBlock } from "@/features/overview/net-worth-block";
import styles from "@/features/overview/overview-page.module.css";
import { SpendingBlock } from "@/features/overview/spending-block";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Blocks stand in the order a phone reads them; the grid keeps that order on the desk.
export function OverviewPage() {
  const t = useT();
  const month = useToday().slice(0, 7);
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.overview")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("overview.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.grid}>
          <div className={styles.wide}>
            <AttentionBlock />
          </div>
          <NetWorthBlock month={month} />
          <MonthFlowsBlock month={month} />
          <SpendingBlock month={month} />
        </div>
      </PageBody>
    </Page>
  );
}
