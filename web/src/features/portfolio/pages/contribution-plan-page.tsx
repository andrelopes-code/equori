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
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { contributionPlanQuery } from "@/features/portfolio/api";
import { ClassTable } from "@/features/portfolio/contribution-plan/class-table";
import { PlanLoadFailed } from "@/features/portfolio/contribution-plan/plan-load-failed";
import { ContributionStrip } from "@/features/portfolio/contribution-plan/contribution-strip";
import { ShoppingPanel } from "@/features/portfolio/contribution-plan/shopping-panel";
import { useContributionPreview } from "@/features/portfolio/contribution-plan/use-contribution-preview";
import styles from "@/features/portfolio/pages/contribution-plan-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";

// Where this month's money goes, how far the portfolio is from the target (spec, Screen).
export function ContributionPlanPage() {
  const t = useT();
  const api = useApi();
  const plan = useQuery(contributionPlanQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const { amount, setAmount, view, pending } = useContributionPreview(
    plan.data,
  );

  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const memberName = (ref: { account_id?: string; instrument?: string }) =>
    ref.instrument ?? names.get(ref.account_id ?? "") ?? "";
  const hasClasses = view === undefined || view.classes.length > 0;

  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack render={(props) => <Link {...props} to="/portfolio" />}>
            {t("nav.portfolio")}
          </PageBack>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {t("contributionPlan.title")}
              </PageHeaderHeading>
              <PageHeaderSubheading>
                {t("contributionPlan.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>

            <PageHeaderActions>
              {/* Edit mode is the next task of the plan: the action waits disabled. */}
              <Button disabled>{t("contributionPlan.edit")}</Button>
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>

      <PageBody>
        <Stack gap={6}>
          {plan.isError && (
            <PlanLoadFailed
              onRetry={() => {
                void plan.refetch();
              }}
            />
          )}

          {view !== undefined && (
            <ContributionStrip
              view={view}
              amount={amount}
              pending={pending}
              onAmount={setAmount}
            />
          )}

          {!plan.isError && hasClasses && (
            <div className={styles.layout}>
              <ClassTable
                view={view}
                pending={pending}
                memberName={memberName}
              />

              {view !== undefined && (
                <ShoppingPanel view={view} memberName={memberName} />
              )}
            </div>
          )}
        </Stack>
      </PageBody>
    </Page>
  );
}
