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
import { BalanceChartBlock } from "@/features/overview/balance-chart-block";
import { BudgetsBlock } from "@/features/overview/budgets-block";
import { CardsBlock } from "@/features/overview/cards-block";
import { DesktopFigures } from "@/features/overview/desktop-figures";
import { GoalsBlock } from "@/features/overview/goals-block";
import { MonthFlowsBlock } from "@/features/overview/month-flows-block";
import { NetWorthBlock } from "@/features/overview/net-worth-block";
import styles from "@/features/overview/overview-page.module.css";
import { SpendingBlock } from "@/features/overview/spending-block";
import { SpendingChart } from "@/features/overview/spending-chart";
import { UpcomingBlock } from "@/features/overview/upcoming-block";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

// Below 1024 px the blocks stand in the order a phone reads them. The desk leads with figures
// and the balance chart and keeps the attention list to a column beside it.
export function OverviewPage() {
  const t = useT();
  const month = useToday().slice(0, 7);
  const wide = useMediaQuery(wideQuery);
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
        {wide ? (
          <div className={styles.desk}>
            <div className={styles.full}>
              <DesktopFigures month={month} />
            </div>
            <div className={styles.chart}>
              <BalanceChartBlock month={month} />
            </div>
            <div className={styles.side}>
              <AttentionBlock limit={4} />
            </div>
            <div className={styles.third}>
              <SpendingChart month={month} />
            </div>
            <div className={styles.third}>
              <UpcomingBlock />
            </div>
            <div className={styles.third}>
              <BudgetsBlock month={month} />
            </div>
            <div className={styles.half}>
              <CardsBlock />
            </div>
            <div className={styles.half}>
              <GoalsBlock />
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            <div className={styles.wide}>
              <AttentionBlock />
            </div>
            <NetWorthBlock month={month} />
            <MonthFlowsBlock month={month} />
            <SpendingBlock month={month} />
            <UpcomingBlock />
            <CardsBlock />
            <BudgetsBlock month={month} />
            <GoalsBlock />
          </div>
        )}
      </PageBody>
    </Page>
  );
}
