import { useQuery } from "@tanstack/react-query";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { GoalBlocks } from "@/features/goals/goal-blocks";
import { goalLine } from "@/features/goals/goal-line";
import { defaultMonthly } from "@/features/goals/goal-plan";
import styles from "@/features/goals/goals-page.module.css";
import { GoalsTable } from "@/features/goals/goals-table";
import { goalsQuery } from "@/features/planning";
import { settingsQuery, useScale } from "@/features/setup";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";
import { useViewport } from "@/ui/use-viewport";

// Complete frontend R5-1 to R5-3. The monthly amounts are a what-if held in the page state.
export function GoalsPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const viewport = useViewport();
  const scaleOf = useScale();
  const goals = useQuery(goalsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const [monthly, setMonthly] = useState<Record<string, number>>({});
  const onMonthly = (id: string, major: number) => {
    setMonthly((current) => ({ ...current, [id]: major }));
  };

  const base = settings.data?.base_currency;
  const ready = goals.data !== undefined && base !== undefined && scaleOf;
  const lines = ready
    ? goals.data.map((goal) => {
        const scale = scaleOf(goal.target.currency);
        const unit = 10 ** scale;
        // defaultMonthly returns a multiple of the step, so the division is exact.
        const major =
          monthly[goal.id] ??
          defaultMonthly(today, goal.due_on, goal.remaining.amount, unit) /
            unit;
        return goalLine(goal, major, scale, today);
      })
    : [];
  // Totals add the goals held in the base currency.
  const inBase = lines.filter((line) => line.goal.target.currency === base);
  const total = {
    saved: inBase.reduce((sum, line) => sum + line.goal.current.amount, 0),
    target: inBase.reduce((sum, line) => sum + line.goal.target.amount, 0),
    currency: base ?? "",
    scale: base !== undefined && scaleOf ? scaleOf(base) : 0,
  };
  const failed = goals.error ?? settings.error;

  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("goals.title")}</PageHeaderHeading>
              {ready && lines.length > 0 && (
                <PageHeaderSubheading>
                  {t(
                    lines.length === 1
                      ? "goals.subtitle.one"
                      : "goals.subtitle.other",
                    {
                      saved: formatMoney(
                        { amount: total.saved, currency: total.currency },
                        total.scale,
                        locale,
                      ),
                      count: lines.length,
                    },
                  )}
                </PageHeaderSubheading>
              )}
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {failed !== null ? (
          <QueryError
            error={failed}
            onRetry={() => {
              void goals.refetch();
              void settings.refetch();
            }}
          />
        ) : !ready ? (
          <SkeletonRegion>
            <Skeleton shape="block" blockSize="12rem" />
          </SkeletonRegion>
        ) : lines.length === 0 ? (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>{t("goals.empty")}</ResultStateTitle>
            </ResultStateContent>
          </ResultState>
        ) : (
          <div className={styles.layout}>
            {viewport === "phone" ? (
              <GoalBlocks lines={lines} onMonthly={onMonthly} />
            ) : (
              <GoalsTable lines={lines} total={total} onMonthly={onMonthly} />
            )}
            <Text size="xs" tone="muted">
              {t("goals.note")}
            </Text>
          </div>
        )}
      </PageBody>
    </Page>
  );
}
