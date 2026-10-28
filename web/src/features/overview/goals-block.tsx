import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { goalState, monthsLeft } from "@/features/goals";
import { MeterHead } from "@/features/overview/meter-head";
import { MeterLine } from "@/features/overview/meter-line";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useBase } from "@/features/overview/use-base";
import { goalsQuery } from "@/features/planning";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

const tones = {
  reached: "success",
  overdue: "danger",
  open: "accent",
} as const;

export function GoalsBlock(placement: Placement) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const today = useToday();
  const { scale } = useBase();
  const goals = useQuery(goalsQuery(api));
  const loading = goals.data === undefined || scale === null;
  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const rows =
    loading || goals.error !== null
      ? []
      : goals.data.map((goal) => {
          const state = goalState(goal, today);
          const left = monthsLeft(today, goal.due_on);
          // Floored, as the goals page writes it: 99.6 % never reads as reached.
          const share = percent.format(
            Math.floor(goal.progress_bp / 100) / 100,
          );
          const status =
            state === "open"
              ? left === 0
                ? t("goals.leftNow")
                : t(left === 1 ? "goals.leftOne" : "goals.left", {
                    count: left,
                  })
              : t(`goals.state.${state}`);
          return {
            key: goal.id,
            to: { to: "/goals" as const },
            title: (
              <MeterHead name={goal.name} share={share} tone={tones[state]} />
            ),
            line: (
              <MeterLine
                label={goal.name}
                basisPoints={goal.progress_bp}
                share={share}
                tone={tones[state]}
                amounts={t("overview.goals.of", {
                  current: fmt.money(
                    goal.current,
                    scale(goal.current.currency),
                  ),
                  target: fmt.money(goal.target, scale(goal.target.currency)),
                })}
                status={status}
                statusTone={state === "open" ? "muted" : tones[state]}
              />
            ),
          };
        });
  return (
    <OverviewBlock
      placement={placement}
      link={{ label: t("overview.goals.open"), options: { to: "/goals" } }}
      loading={loading && goals.error === null}
      error={goals.error}
      onRetry={() => void goals.refetch()}
      empty={rows.length === 0 ? t("overview.goals.empty") : undefined}
    >
      <OverviewRows label={t("overview.goals.title")} rows={rows} />
    </OverviewBlock>
  );
}
