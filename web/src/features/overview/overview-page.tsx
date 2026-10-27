import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
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
import { IndicatorsBlock } from "@/features/overview/indicators-block";
import { MonthFlowsBlock } from "@/features/overview/month-flows-block";
import { NetWorthBlock } from "@/features/overview/net-worth-block";
import styles from "@/features/overview/overview-page.module.css";
import { SpendingBlock } from "@/features/overview/spending-block";
import { SpendingChart } from "@/features/overview/spending-chart";
import { UpcomingBlock } from "@/features/overview/upcoming-block";
import {
  useHiddenBlocks,
  type BlockID,
} from "@/features/overview/use-hidden-blocks";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

// Below 1024 px the blocks stand in the order a phone reads them. The desk leads with figures
// and the balance chart and keeps the attention list to a column beside it.
export function OverviewPage() {
  const t = useT();
  const month = useToday().slice(0, 7);
  const wide = useMediaQuery(wideQuery);
  const { hidden, hide, showAll } = useHiddenBlocks();
  const hideOf = (id: BlockID) => () => {
    hide(id);
  };
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
            {hidden.size > 0 && (
              <PageHeaderActions>
                <Button variant="ghost" onClick={showAll}>
                  {t("overview.block.showHidden", {
                    count: String(hidden.size),
                  })}
                </Button>
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {wide ? (
          <div className={styles.desk}>
            <div className={styles.full}>
              <DesktopFigures month={month} />
            </div>
            {!hidden.has("indicators") && (
              <div className={styles.full}>
                <IndicatorsBlock month={month} onHide={hideOf("indicators")} />
              </div>
            )}
            <div className={styles.chart}>
              <BalanceChartBlock month={month} />
            </div>
            <div className={styles.side}>
              <AttentionBlock limit={4} />
            </div>
            {!hidden.has("spending") && (
              <div className={styles.third}>
                <SpendingChart month={month} onHide={hideOf("spending")} />
              </div>
            )}
            {!hidden.has("upcoming") && (
              <div className={styles.third}>
                <UpcomingBlock onHide={hideOf("upcoming")} />
              </div>
            )}
            {!hidden.has("budgets") && (
              <div className={styles.third}>
                <BudgetsBlock month={month} onHide={hideOf("budgets")} />
              </div>
            )}
            {!hidden.has("cards") && (
              <div className={styles.half}>
                <CardsBlock onHide={hideOf("cards")} />
              </div>
            )}
            {!hidden.has("goals") && (
              <div className={styles.half}>
                <GoalsBlock onHide={hideOf("goals")} />
              </div>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            <div className={styles.wide}>
              <AttentionBlock />
            </div>
            {!hidden.has("net-worth") && (
              <NetWorthBlock month={month} onHide={hideOf("net-worth")} />
            )}
            {!hidden.has("indicators") && (
              <IndicatorsBlock month={month} onHide={hideOf("indicators")} />
            )}
            {!hidden.has("month-flows") && (
              <MonthFlowsBlock month={month} onHide={hideOf("month-flows")} />
            )}
            {!hidden.has("spending") && (
              <SpendingBlock month={month} onHide={hideOf("spending")} />
            )}
            {!hidden.has("upcoming") && (
              <UpcomingBlock onHide={hideOf("upcoming")} />
            )}
            {!hidden.has("cards") && <CardsBlock onHide={hideOf("cards")} />}
            {!hidden.has("budgets") && (
              <BudgetsBlock month={month} onHide={hideOf("budgets")} />
            )}
            {!hidden.has("goals") && <GoalsBlock onHide={hideOf("goals")} />}
          </div>
        )}
      </PageBody>
    </Page>
  );
}
