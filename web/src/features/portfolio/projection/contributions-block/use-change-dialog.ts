import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { changeEffect } from "@/features/portfolio/projection/contributions-block/change-effect";
import type { ChangeEffect } from "@/features/portfolio/projection/contributions-block/change-effect";
import {
  monthError,
  nextMonth,
} from "@/features/portfolio/projection/contributions-block/change-month-error";
import type { MonthError } from "@/features/portfolio/projection/contributions-block/change-month-error";
import type { EditTarget } from "@/features/portfolio/projection/contributions-block/use-contribution-edit";
import type { ProjectInput } from "@/features/portfolio/projection/model/project";

type Change = components["schemas"]["ProjectionChange"];

interface ChangeDialogInput {
  target: EditTarget;
  others: readonly Change[];
  current: string;
  base: Omit<ProjectInput, "changes">;
  onSave: (change: Change) => void;
}

export interface ChangeDialogState {
  month: string;
  setMonth: (month: string) => void;
  amount: number;
  setAmount: (minor: number) => void;
  error: MonthError | null;
  effect: ChangeEffect | null;
  submit: () => void;
}

// PX9: the month and the amount typed in the dialog, the error of the month and the effect on the
// value at the withdrawal age. A month in error makes the save do nothing.
export function useChangeDialog({
  target,
  others,
  current,
  base,
  onSave,
}: ChangeDialogInput): ChangeDialogState {
  const [month, setMonth] = useState(
    target.change?.month.slice(0, 7) ?? nextMonth(others, current),
  );
  const [amount, setAmount] = useState(target.change?.amount ?? 0);

  const error = monthError(month, others, current, base.withdrawalFrom);
  const change = { month: `${month}-01`, amount };
  const effect = error === null ? changeEffect(base, others, change) : null;

  function submit() {
    if (error !== null) return;

    onSave(change);
  }

  return { month, setMonth, amount, setAmount, error, effect, submit };
}
