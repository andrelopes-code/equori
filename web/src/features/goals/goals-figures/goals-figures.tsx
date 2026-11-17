import type { Goal } from "@/features/goals/goal-card/goal-line";
import { goalState } from "@/features/goals/goal-card/goal-state";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";

interface GoalsFiguresProps {
  goals: readonly Goal[];
  loading: boolean;
}

// The three figures above the goals: how many, how many reached, and the nearest due date.
export function GoalsFigures({ goals, loading }: GoalsFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();

  const states = goals.map((g) => goalState(g, today));
  const reached = states.filter((s) => s === "reached").length;
  const nextDue = goals
    .filter((g, i) => states[i] === "open")
    .map((g) => g.due_on)
    .sort()[0];

  return (
    <FigureGrid label={t("goals.figures")}>
      <FigureCard
        label={t("goals.figure.count")}
        value={loading ? undefined : String(goals.length)}
        note={t("goals.countNote")}
        loading={loading}
      />
      <FigureCard
        label={t("goals.figure.reached")}
        value={loading ? undefined : String(reached)}
        note={t("goals.reachedNote")}
        loading={loading}
      />
      <FigureCard
        label={t("goals.figure.next")}
        value={
          loading
            ? undefined
            : nextDue === undefined
              ? t("goals.nothingDue")
              : formatDate(nextDue, locale)
        }
        note={t("goals.nextNote")}
        loading={loading}
      />
    </FigureGrid>
  );
}
