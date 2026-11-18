import { ButtonLink } from "@slotted/react/button";
import { Link } from "@tanstack/react-router";

import type { Goal } from "@/features/goals/goal-card/goal-line";
import { schedulePreset } from "@/features/goals/model/goal-links";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface GoalScheduleActionProps {
  goal: Goal;
  // The monthly amount of the what-if, in minor units.
  amount: number;
  scale: number;
}

// Opens the schedule form on a saving of the what-if amount into the goal's account, for the
// goal when the account is shared (planning coherence section 6). Draws nothing at zero.
export function GoalScheduleAction({
  goal,
  amount,
  scale,
}: GoalScheduleActionProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const preset = schedulePreset(goal, amount);

  if (preset === undefined) return null;

  return (
    <ButtonLink
      size="sm"
      variant="outline"
      tone="secondary"
      render={(props) => (
        <Link {...props} to="/planning/schedules/new" search={preset} />
      )}
    >
      {t("goals.schedule", {
        amount: fmt.money({ amount, currency: goal.target.currency }, scale),
      })}
    </ButtonLink>
  );
}
