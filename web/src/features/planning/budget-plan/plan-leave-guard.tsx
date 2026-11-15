import { PlanDiscardDialog } from "@/features/planning/budget-plan/plan-discard-dialog";
import { usePlanBlocker } from "@/features/planning/budget-plan/use-plan-blocker";

interface PlanLeaveGuardProps {
  pending: number;
  // The month of the plan as a sentence writes it.
  month: string;
  onDiscard: () => void;
  // The reader kept editing over a navigation: the control that started it returns.
  onStay: () => void;
}

// Asks before a navigation leaves unsaved changes (budget plan spec 5.2).
export function PlanLeaveGuard({
  pending,
  month,
  onDiscard,
  onStay,
}: PlanLeaveGuardProps) {
  const blocker = usePlanBlocker(pending);
  if (!blocker.asking) return null;

  return (
    <PlanDiscardDialog
      pending={pending}
      month={month}
      onKeep={() => {
        blocker.answer(true);
        onStay();
      }}
      onDiscard={() => {
        onDiscard();
        blocker.answer(false);
      }}
    />
  );
}
