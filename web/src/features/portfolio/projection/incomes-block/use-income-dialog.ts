import { useState } from "react";

import {
  formOf,
  incomeErrors,
  incomeOf,
} from "@/features/portfolio/projection/incomes-block/income-form";
import type {
  IncomeErrors,
  IncomeForm,
} from "@/features/portfolio/projection/incomes-block/income-form";
import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";

export interface IncomeDialogState {
  form: IncomeForm;
  change: (patch: Partial<IncomeForm>) => void;
  errors: IncomeErrors;
  submit: () => void;
}

// PJ8: the income typed in the dialog. The errors are written from the first save on, and while
// one stands the save does nothing.
export function useIncomeDialog(
  income: OtherIncome | null,
  onSave: (income: OtherIncome) => void,
): IncomeDialogState {
  const [form, setForm] = useState(() => formOf(income));
  const [tried, setTried] = useState(false);

  const errors = incomeErrors(form);

  function change(patch: Partial<IncomeForm>) {
    setForm({ ...form, ...patch });
  }

  function submit() {
    setTried(true);
    if (Object.keys(errors).length > 0) return;

    onSave(incomeOf(form));
  }

  return { form, change, errors: tried ? errors : {}, submit };
}
