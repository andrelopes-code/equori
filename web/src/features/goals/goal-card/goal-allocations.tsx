import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { GoalAllocateDialog } from "@/features/goals/goal-card/goal-allocate-dialog";
import type { Goal } from "@/features/goals/goal-card/goal-line";
import { sharedLines } from "@/features/goals/model/goal-links";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface GoalAllocationsProps {
  goal: Goal;
  // Every goal of the book, to name the ones that share an account with this one.
  goals: readonly Goal[];
  scale: (code: string) => number;
  names: ReadonlyMap<string, string>;
}

// What the goal holds in each shared account, what stands above the balance after a
// withdrawal, the goals that share its accounts, and the two actions over its allocations
// (planning coherence A255). Draws nothing for a goal that shares no account.
export function GoalAllocations({
  goal,
  goals,
  scale,
  names,
}: GoalAllocationsProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const [mode, setMode] = useState<"aside" | "release" | null>(null);

  const shared = sharedLines(goal, goals, names);
  if (goal.allocated_accounts.length === 0 && shared.length === 0) return null;

  const money = (m: Goal["target"]) => fmt.money(m, scale(m.currency));
  const handleClose = () => {
    setMode(null);
  };

  return (
    <Stack gap={1}>
      {goal.allocated_accounts.map((a) => (
        <Text key={a.account_id} size="sm" numeric="tabular">
          {t("goals.allocated", {
            allocated: money(a.allocated),
            account: names.get(a.account_id) ?? "",
          })}
        </Text>
      ))}

      {goal.allocated_accounts
        .filter((a) => a.available.amount < 0)
        .map((a) => (
          <Text key={a.account_id} size="sm" tone="danger" numeric="tabular">
            {t("goals.overAllocated", {
              amount: money({ ...a.available, amount: -a.available.amount }),
              account: names.get(a.account_id) ?? "",
            })}
          </Text>
        ))}

      {shared.map((line) => (
        <Text key={`${line.account}-${line.goal}`} size="sm" tone="muted">
          {t("goals.sharedWith", { account: line.account, goal: line.goal })}
        </Text>
      ))}

      {goal.allocated_accounts.length > 0 && (
        <Inline gap={2}>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={() => {
              setMode("aside");
            }}
          >
            {t("goals.setAside")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={() => {
              setMode("release");
            }}
          >
            {t("goals.release")}
          </Button>
        </Inline>
      )}

      {mode !== null && (
        <GoalAllocateDialog
          goal={goal}
          mode={mode}
          scale={scale}
          names={names}
          onDone={handleClose}
          onCancel={handleClose}
        />
      )}
    </Stack>
  );
}
