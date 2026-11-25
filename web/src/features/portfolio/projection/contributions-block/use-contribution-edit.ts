import { useState } from "react";

import type { components } from "@/api/schema.gen";

type Change = components["schemas"]["ProjectionChange"];

// The change the dialog works on; `change` is null for a new one.
export interface EditTarget {
  change: Change | null;
}

// PX9: which change the dialog edits, and how saving or removing it rewrites the list. The list
// stays in the draft: "Salvar plano" is what stores it.
export function useContributionEdit(
  changes: readonly Change[],
  onChange: (next: Change[]) => void,
) {
  const [target, setTarget] = useState<EditTarget | undefined>(undefined);

  function add() {
    setTarget({ change: null });
  }

  function edit(change: Change) {
    setTarget({ change });
  }

  function close() {
    setTarget(undefined);
  }

  function save(saved: Change) {
    if (target === undefined) return;

    onChange(
      [...othersOf(changes, target), saved].sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
    );
    close();
  }

  function remove() {
    if (target === undefined) return;

    onChange(othersOf(changes, target));
    close();
  }

  return { target, add, edit, close, save, remove };
}

// The changes of the plan other than the one the dialog edits.
export function othersOf(
  changes: readonly Change[],
  target: EditTarget,
): Change[] {
  return changes.filter((c) => c.month !== target.change?.month);
}
