import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useResolveRecords } from "@/features/accounts/api";
import {
  actionItems,
  isSelectable,
  suggestionItems,
} from "@/features/accounts/review-selection";
import { useT } from "@/i18n/i18n-provider";
import { bulkOutcome } from "@/ui/bulk-outcome";
import type { BulkOutcome } from "@/ui/bulk-outcome";

type ExternalRecord = components["schemas"]["ExternalRecord"];
type BulkResolveItem =
  components["schemas"]["BulkResolveInput"]["items"][number];

interface Settled {
  outcome: BulkOutcome;
  labels: Map<string, string>;
}

export function useReviewSelection(
  records: readonly ExternalRecord[],
  filter: string,
  onSettled: () => void,
) {
  const t = useT();
  const resolve = useResolveRecords();

  const [selected, setSelected] = useState<string[]>([]);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [seen, setSeen] = useState(filter);

  if (seen !== filter) {
    setSeen(filter);
    setSelected([]);
  }

  const selectable = records.filter(isSelectable);
  const rows = selectable.filter((r) => selected.includes(r.id));
  const first = rows[0];
  const total =
    first === undefined
      ? undefined
      : {
          amount: rows.reduce((sum, r) => sum + r.amount.amount, 0),
          currency: first.amount.currency,
        };

  function toggle(id: string) {
    setSelected((now) =>
      now.includes(id) ? now.filter((x) => x !== id) : [...now, id],
    );
  }

  function toggleAll() {
    setSelected(
      selected.length === selectable.length ? [] : selectable.map((r) => r.id),
    );
  }

  function clear() {
    setSelected([]);
  }

  function confirm() {
    run(suggestionItems(records, selected));
  }

  function create() {
    run(actionItems(records, selected, "create"));
  }

  function discard() {
    setDiscarding(false);
    run(actionItems(records, selected, "discard"));
  }

  function run(items: BulkResolveItem[]) {
    const labels = new Map(
      records.map((r) => [
        r.id,
        r.description === "" ? t("ledger.untitled") : r.description,
      ]),
    );
    setError(null);
    setSettled(null);
    resolve
      .mutateAsync(items)
      .then((results) => {
        setSettled({
          outcome: bulkOutcome(
            results.map((r) => ({ id: r.record_id, status: r.status })),
            "resolved",
          ),
          labels,
        });
      })
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      })
      .finally(() => {
        setSelected([]);
        onSettled();
      });
  }

  return {
    selected,
    selectableCount: selectable.length,
    suggestions: suggestionItems(records, selected).length,
    total,
    outcome: settled?.outcome,
    labelOf: (id: string) => settled?.labels.get(id) ?? id,
    error,
    busy: resolve.isPending,
    discarding,
    setDiscarding,
    toggle,
    toggleAll,
    clear,
    confirm,
    create,
    discard,
  };
}

export type ReviewSelection = ReturnType<typeof useReviewSelection>;
