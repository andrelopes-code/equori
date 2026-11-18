import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { goalsQuery } from "@/features/planning/api";
import { useT } from "@/i18n/i18n-provider";

interface ScheduleGoalNoteProps {
  // The goal of the draft; null without one.
  goalID: string | null;
}

// Says which goal each occurrence of the schedule sets its amount aside for (planning coherence
// A255). Draws nothing for a schedule without a goal.
export function ScheduleGoalNote({ goalID }: ScheduleGoalNoteProps) {
  const t = useT();
  const api = useApi();
  const goals = useQuery({ ...goalsQuery(api), enabled: goalID !== null });
  const goal = goals.data?.find((g) => g.id === goalID);

  if (goal === undefined) return null;

  return (
    <Text size="sm" tone="muted">
      {t("schedule.goalNote", { name: goal.name })}
    </Text>
  );
}
