import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import type { CategorizeActions } from "@/features/transactions/use-categorize-actions";
import type { ListRow } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];

export type SelectionCommands = ReturnType<typeof useSelectionCommands>;

export function useSelectionCommands(
  rows: readonly ListRow[],
  categoriesById: Map<string, CategoryEntry>,
  actions: CategorizeActions,
) {
  const t = useT();

  const [selection, setSelection] = useState<readonly string[]>([]);
  const [picking, setPicking] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const selectedRows = rows.filter((row) => selection.includes(row.id));
  const selectedAmount = selectedRows.reduce(
    (sum, row) => sum + row.money.amount,
    0,
  );

  const categorizeSelection = async (categoryId: string) => {
    const category = categoriesById.get(categoryId);
    if (category === undefined) return;
    setBulkBusy(true);
    try {
      await actions.categorizeMany(
        selectedRows.map((row) => row.transaction),
        category,
      );
      setSelection([]);
    } catch (error) {
      toast.show({ tone: "danger", title: errorText(error, t) });
    } finally {
      setBulkBusy(false);
    }
  };

  const recordSuggestions = async (
    accepted: { transaction: Transaction; categoryId: string }[],
  ) => {
    // The dialog closes first: a write marks every query stale, and an open dialog would
    // ask the model again.
    setSuggesting(false);
    setBulkBusy(true);
    try {
      for (const categoryId of new Set(accepted.map((a) => a.categoryId))) {
        const category = categoriesById.get(categoryId);
        if (category === undefined) continue;
        await actions.categorizeMany(
          accepted
            .filter((a) => a.categoryId === categoryId)
            .map((a) => a.transaction),
          category,
        );
      }
      setSelection([]);
    } catch (error) {
      toast.show({ tone: "danger", title: errorText(error, t) });
    } finally {
      setBulkBusy(false);
    }
  };

  return {
    selection,
    setSelection,
    picking,
    setPicking,
    bulkBusy,
    suggesting,
    setSuggesting,
    selectedRows,
    selectedAmount,
    categorizeSelection,
    recordSuggestions,
  };
}
