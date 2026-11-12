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
import { errorText } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import { contributionPlanQuery } from "@/features/portfolio/api";
import { ClassTable } from "@/features/portfolio/contribution-plan/table/class-table";
import { ContributionEmpty } from "@/features/portfolio/contribution-plan/states/contribution-empty";
import { ContributionSaveBar } from "@/features/portfolio/contribution-plan/editor/contribution-save-bar";
import { ContributionStrip } from "@/features/portfolio/contribution-plan/strip/contribution-strip";
import { IncompleteNotice } from "@/features/portfolio/contribution-plan/states/incomplete-notice";
import { LeaveDialog } from "@/features/portfolio/contribution-plan/editor/leave-dialog";
import { OutsideSection } from "@/features/portfolio/contribution-plan/outside/outside-section";
import { PlanLoadFailed } from "@/features/portfolio/contribution-plan/states/plan-load-failed";
import { overlayDraft } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { ShoppingPanel } from "@/features/portfolio/contribution-plan/shopping/shopping-panel";
import { TrackLegend } from "@/features/portfolio/contribution-plan/table/track-legend";
import { useContributionPreview } from "@/features/portfolio/contribution-plan/editor/use-contribution-preview";
import { useLeaveGuard } from "@/features/portfolio/contribution-plan/editor/use-leave-guard";
import { usePlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import styles from "@/features/portfolio/pages/contribution-plan-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { PageBack } from "@/ui/navigation/page-back";

// Where this month's money goes, how far the portfolio is from the target (spec, Screen).
export function ContributionPlanPage() {
  const t = useT();
  const api = useApi();
  const plan = useQuery(contributionPlanQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const editor = usePlanEditor(plan.data);
  const guard = useLeaveGuard(editor.dirty);
  const { amount, setAmount, view, pending } = useContributionPreview(
    plan.data,
    editor.draft,
  );

  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const memberName = (ref: { account_id?: string; instrument?: string }) =>
    ref.instrument ?? names.get(ref.account_id ?? "") ?? "";
  const shown =
    view !== undefined && editor.draft !== undefined
      ? overlayDraft(view, editor.draft)
      : view;
  const empty = shown?.classes.length === 0 && editor.draft === undefined;
  const nameless = editor.draft?.classes.some((c) => c.name.trim() === "");

  function handleSave() {
    const money =
      amount > 0 && view !== undefined
        ? { amount, currency: view.total.currency }
        : undefined;
    editor.save(money);
  }

  return (
    <Page
      width="full"
      footer={
        editor.draft !== undefined && (
          <ContributionSaveBar
            saving={editor.saving}
            disabled={!editor.dirty || nameless === true}
            onDiscard={editor.discard}
            onSave={handleSave}
          />
        )
      }
    >
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
              {editor.draft === undefined && !empty && (
                <Button
                  disabled={plan.data === undefined}
                  onClick={editor.start}
                >
                  {t("contributionPlan.edit")}
                </Button>
              )}
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

          {editor.error !== null && (
            <FormNotice>{errorText(editor.error, t)}</FormNotice>
          )}

          {shown !== undefined && <IncompleteNotice view={shown} />}

          {shown !== undefined && empty && (
            <ContributionEmpty view={shown} onStart={editor.startFrom} />
          )}

          {shown !== undefined && !empty && (
            <ContributionStrip
              view={shown}
              amount={amount}
              pending={pending}
              onAmount={setAmount}
            />
          )}

          {!plan.isError && !empty && (
            <div className={styles.layout}>
              <Stack gap={3}>
                <ClassTable
                  view={shown}
                  pending={pending}
                  editor={editor}
                  memberName={memberName}
                />

                {shown !== undefined && <TrackLegend />}
              </Stack>

              {shown !== undefined && (
                <ShoppingPanel view={shown} memberName={memberName} />
              )}
            </div>
          )}

          {shown !== undefined && !empty && (
            <OutsideSection
              view={shown}
              memberName={memberName}
              onChoose={editor.addMember}
            />
          )}
        </Stack>
      </PageBody>

      {guard.asking && (
        <LeaveDialog
          onKeep={() => {
            guard.answer(true);
          }}
          onDiscard={() => {
            guard.answer(false);
          }}
        />
      )}
    </Page>
  );
}
