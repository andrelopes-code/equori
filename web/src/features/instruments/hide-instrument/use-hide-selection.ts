import { useMemo, useState } from "react";

import { useSetInstrumentsHidden } from "@/features/instruments/api";
import type { CatalogRow } from "@/features/instruments/model/catalog-rows";

// A238 HD13: the marked rows of the list and the one action that hides or shows them.
export function useHideSelection(rows: readonly CatalogRow[]) {
  const { mutate, data: outcome, isPending } = useSetInstrumentsHidden();

  const [marked, setMarked] = useState<readonly string[]>([]);

  // A marked row that leaves the list (the hidden rows left out again) leaves the selection.
  const selected = useMemo(() => {
    const codes = new Set(marked);

    return rows.filter((row) => codes.has(row.code));
  }, [rows, marked]);
  const selection = useMemo(() => selected.map((row) => row.code), [selected]);

  const toHide = selected.filter((row) => !row.hidden).length;
  const toShow = selected.length - toHide;

  function setHidden(hidden: boolean) {
    const codes = selected
      .filter((row) => row.hidden !== hidden)
      .map((row) => row.code);

    mutate(
      { codes, hidden },
      {
        onSuccess: ({ refused }) => {
          setMarked(refused.map((item) => item.id));
        },
      },
    );
  }

  return {
    selection,
    setMarked,
    toHide,
    toShow,
    pending: isPending,
    refusal:
      outcome !== undefined && outcome.refused.length > 0 ? outcome : null,
    setHidden,
  };
}

export type HideSelection = ReturnType<typeof useHideSelection>;
