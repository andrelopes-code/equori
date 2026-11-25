import { useState } from "react";

import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";

// The income the dialog works on, by its place in the list; a new one has none.
export interface IncomeTarget {
  index: number | null;
  income: OtherIncome | null;
}

// PX21: which income the dialog edits, and how saving or removing it rewrites the list. The list
// stays in the draft: "Salvar plano" is what stores it.
export function useIncomeEdit(
  incomes: readonly OtherIncome[],
  onChange: (next: OtherIncome[]) => void,
) {
  const [target, setTarget] = useState<IncomeTarget | undefined>(undefined);

  function add() {
    setTarget({ index: null, income: null });
  }

  function edit(index: number) {
    setTarget({ index, income: incomes[index] ?? null });
  }

  function close() {
    setTarget(undefined);
  }

  function save(saved: OtherIncome) {
    onChange(
      [...othersOf(target), saved].sort((a, b) => a.start_age - b.start_age),
    );
    close();
  }

  function remove() {
    onChange(othersOf(target));
    close();
  }

  function othersOf(edited: IncomeTarget | undefined) {
    return incomes.filter((_, i) => i !== edited?.index);
  }

  return { target, add, edit, close, save, remove };
}
