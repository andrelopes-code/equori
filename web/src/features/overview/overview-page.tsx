import { useNavigate, useSearch } from "@tanstack/react-router";
import { ButtonLink, IconButton } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderArea,
  PageHeaderContent,
  PageHeaderHeading,
  PageHeaderNavigation,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { AccountGroups } from "@/features/accounts";
import { shiftMonth } from "@/features/overview/forecast";
import { BudgetTable } from "@/features/overview/budget-table";
import { ForecastChart } from "@/features/overview/forecast-chart";
import { OverviewFigures } from "@/features/overview/overview-figures";
import styles from "@/features/overview/overview-page.module.css";
import { UpcomingTable } from "@/features/overview/upcoming-table";
import { useOverview } from "@/features/overview/use-overview";
import { TransactionList } from "@/features/transactions";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { IconGlyph } from "@/ui/icon-glyph";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

const recentLimit = 6;

// Complete frontend O1–O7.
export function OverviewPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const navigate = useNavigate();
  const today = useToday();
  const search: { month?: string } = useSearch({ strict: false });
  const currentMonth = today.slice(0, 7);
  const month =
    search.month !== undefined && search.month < currentMonth
      ? search.month
      : currentMonth;
  const { overview, scale, failed, retry } = useOverview(month);
  const go = (next: string) => {
    void navigate({
      to: "/",
      search: next === currentMonth ? {} : { month: next },
    });
  };
  const names = overview?.scope.map((account) => account.name).join(", ");
  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {formatMonthTitle(month, locale)}
              </PageHeaderHeading>
              <PageHeaderSubheading>
                {names === undefined
                  ? t("nav.overview")
                  : names === ""
                    ? t("overview.scope.none")
                    : t("overview.scope", { accounts: names })}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderNavigation>
              <IconButton
                aria-label={t("overview.month.previous")}
                variant="ghost"
                onClick={() => {
                  go(shiftMonth(month, -1));
                }}
              >
                <IconGlyph name="chevron-left" />
              </IconButton>
              <IconButton
                aria-label={t("overview.month.next")}
                variant="ghost"
                disabled={month === currentMonth}
                onClick={() => {
                  go(shiftMonth(month, 1));
                }}
              >
                <IconGlyph name="chevron-right" />
              </IconButton>
            </PageHeaderNavigation>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        <PageHeaderArea>
          <PageHeaderContent>
            <section
              aria-label={t("home.balances")}
              aria-busy={overview === undefined}
            >
              {failed !== null ? (
                <QueryError error={failed} onRetry={retry} />
              ) : overview === undefined || scale === null ? (
                <SkeletonRegion>
                  <Skeleton shape="block" blockSize="5rem" />
                </SkeletonRegion>
              ) : overview.noAccounts ? (
                <ResultState status="empty" reach="section">
                  <ResultStateContent>
                    <ResultStateTitle>{t("home.empty")}</ResultStateTitle>
                  </ResultStateContent>
                  <ResultStateActions>
                    <ButtonLink
                      {...spaLink("/accounts")}
                      tone="secondary"
                      variant="outline"
                    >
                      {t("home.empty.action")}
                    </ButtonLink>
                  </ResultStateActions>
                </ResultState>
              ) : (
                <OverviewFigures overview={overview} scale={scale} />
              )}
            </section>
          </PageHeaderContent>
        </PageHeaderArea>
      </PageHeader>
      <PageBody>
        <div className={styles.layout}>
          {overview !== undefined && scale !== null && !overview.noAccounts && (
            <>
              <div className={styles.full}>
                <ForecastChart overview={overview} scale={scale} />
              </div>
              {overview.current && (
                <UpcomingTable overview={overview} scale={scale} />
              )}
              <div className={overview.current ? undefined : styles.full}>
                <BudgetTable overview={overview} scale={scale} />
              </div>
            </>
          )}
          <Section>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("home.recent")}</SectionHeading>
              </SectionTitle>
              {viewport !== "phone" && (
                <SectionActions>
                  <ButtonLink
                    {...spaLink("/transactions")}
                    tone="secondary"
                    variant="ghost"
                    size="sm"
                  >
                    {t("home.recent.all")}
                  </ButtonLink>
                </SectionActions>
              )}
            </SectionHeader>
            <SectionBody>
              <TransactionList
                search={{}}
                limit={recentLimit}
                infinite={false}
                brief
              />
            </SectionBody>
          </Section>
          {overview?.noAccounts !== true && (
            <Section>
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t("home.accounts")}</SectionHeading>
                </SectionTitle>
                {viewport !== "phone" && (
                  <SectionActions>
                    <ButtonLink
                      {...spaLink("/accounts")}
                      tone="secondary"
                      variant="ghost"
                      size="sm"
                    >
                      {t("home.accounts.all")}
                    </ButtonLink>
                  </SectionActions>
                )}
              </SectionHeader>
              <SectionBody>
                <AccountGroups />
              </SectionBody>
            </Section>
          )}
        </div>
      </PageBody>
    </Page>
  );
}
