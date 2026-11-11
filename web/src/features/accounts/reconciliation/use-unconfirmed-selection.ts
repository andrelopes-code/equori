import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import type { BulkOutcome } from "@/ui/bulk-outcome";

type UnconfirmedEntry = components["schemas"]["UnconfirmedEntry"];

export function useUnconfirmedSelection(entries: readonly UnconfirmedEntry[]) {
  const t = useT();

  const [selection, setSelection] = useState<readonly string[]>([]);
  const [voiding, setVoiding] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);

  const selected = entries.filter((e) => selection.includes(e.transaction_id));
  const selectedIds = selected.map((e) => e.transaction_id);
  const currencies = new Set(selected.map((e) => e.amount.currency));
  const amount =
    selected[0] !== undefined && currencies.size === 1
      ? {
          amount: selected.reduce((sum, e) => sum + e.amount.amount, 0),
          currency: selected[0].amount.currency,
        }
      : undefined;

  const labelOf = (id: string) => {
    const description = entries.find(
      (e) => e.transaction_id === id,
    )?.description;
    return description === undefined || description === ""
      ? t("ledger.untitled")
      : description;
  };

  const clear = () => {
    setSelection([]);
  };

  const startVoid = () => {
    setVoiding(true);
  };

  const finishVoid = (done: BulkOutcome) => {
    setOutcome(done);
    setSelection([]);
  };

  return {
    selection,
    setSelection,
    voiding,
    setVoiding,
    outcome,
    selectedIds,
    amount,
    labelOf,
    clear,
    startVoid,
    finishVoid,
  };
}
