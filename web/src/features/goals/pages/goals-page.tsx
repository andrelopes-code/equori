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
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Button } from "@slotted/react/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import {
  holdsInvestments,
  scheduledContribution,
} from "@/features/goals/model/goal-contribution";
import { goalsQuery, schedulesQuery } from "@/features/planning";
import { GoalCard } from "@/features/goals/goal-card/goal-card";
import { DeleteGoalDialog } from "@/features/goals/goal-dialog/delete-goal-dialog";
import { GoalDialog } from "@/features/goals/goal-dialog/goal-dialog";
import type { Goal } from "@/features/goals/goal-card/goal-line";
import { GoalsFigures } from "@/features/goals/goals-figures/goals-figures";
import styles from "@/features/goals/pages/goals.module.css";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderAction } from "@/ui/navigation/header-action";
import { HeaderProgress } from "@/ui/navigation/header-progress";
import { QueryError } from "@/ui/feedback/query-error";
import { RefreshButton } from "@/ui/feedback/refresh-button";
import { useRefresh } from "@/ui/feedback/use-refresh";

// The savings goals: how far each one is, what is left and what each month's saving does to
// the month it completes.
export function GoalsPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const queryClient = useQueryClient();
  const scale = useScale();
  const goals = useQuery(goalsQuery(api));
  const schedules = useQuery(schedulesQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const items = goals.data ?? [];
  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const loading = goals.isPending || scale === null;
  const refresh = useRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ["planning"] }),
  );
  const create = () => {
    setCreating(true);
  };
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.goals")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t(
                  items.length === 1 ? "goals.subtitleOne" : "goals.subtitle",
                  {
                    count: items.length,
                  },
                )}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <RefreshButton
                label={t("goals.refresh")}
                refreshing={refresh.refreshing}
                onRefresh={refresh.refresh}
              />
              <HeaderAction
                primary
                label={t("goals.new")}
                glyph="plus"
                onClick={create}
              />
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        <HeaderProgress
          loading={refresh.refreshing || (goals.isFetching && !goals.isPending)}
          {...(refresh.refreshing ? { delay: 0 } : {})}
        />
      </PageHeader>
      <PageBody>
        {goals.isError ? (
          <QueryError
            error={goals.error}
            onRetry={() => void goals.refetch()}
          />
        ) : !goals.isPending && items.length === 0 ? (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>{t("goals.empty")}</ResultStateTitle>
              <ResultStateDescription>
                {t("goals.emptyHint")}
              </ResultStateDescription>
            </ResultStateContent>
            <ResultStateActions>
              <Button onClick={create}>{t("goals.new")}</Button>
            </ResultStateActions>
          </ResultState>
        ) : (
          <div className={styles.page}>
            <GoalsFigures goals={items} loading={loading} />

            <div className={styles.grid}>
              {scale !== null &&
                items.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    scale={scale}
                    scheduled={scheduledContribution(
                      goal,
                      schedules.data ?? [],
                      accounts.data ?? [],
                      today,
                    )}
                    names={names}
                    investing={holdsInvestments(
                      goal.account_ids,
                      accounts.data ?? [],
                    )}
                    onEdit={setEditing}
                    onDelete={setDeleting}
                  />
                ))}
            </div>
          </div>
        )}
      </PageBody>
      {creating && (
        <GoalDialog
          onDone={() => {
            setCreating(false);
          }}
          onCancel={() => {
            setCreating(false);
          }}
        />
      )}
      {editing !== null && (
        <GoalDialog
          key={editing.id}
          goal={editing}
          onDone={() => {
            setEditing(null);
          }}
          onCancel={() => {
            setEditing(null);
          }}
        />
      )}
      {deleting !== null && (
        <DeleteGoalDialog
          goal={deleting}
          onDone={() => {
            setDeleting(null);
          }}
          onCancel={() => {
            setDeleting(null);
          }}
        />
      )}
    </Page>
  );
}
