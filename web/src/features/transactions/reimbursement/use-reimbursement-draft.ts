import { toast } from "@slotted/react/toast";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { useReimburseTransaction } from "@/features/transactions/api";
import {
  allocationTotals,
  fillAllocation,
} from "@/features/transactions/model/reimbursement";
import { reimbursementErrorText } from "@/features/transactions/reimbursement/reimbursement-error";
import { statusLine } from "@/features/transactions/reimbursement/reimbursement-status";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Candidate = components["schemas"]["ReimbursementCandidate"];
type Transaction = components["schemas"]["Transaction"];
type Allocation = components["schemas"]["ReimbursementAllocation"];

export interface DraftRow {
  item: Candidate;
  checked: boolean;
  amount: number;
}

interface RowState {
  checked: boolean;
  amount: number;
}

// A117: the inflow repays the expenses the reader checks, each with its own amount; the rest of
// the inflow stays income. The list is sent whole and replaces the earlier one.
export function useReimbursementDraft(
  transaction: Transaction,
  items: readonly Candidate[],
  inflow: number,
  onOpenChange: (open: boolean) => void,
) {
  const t = useT();
  const reimburse = useReimburseTransaction();
  const [edits, setEdits] = useState<Record<string, RowState>>({});
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows: DraftRow[] = items.map((item) => {
    const allocated = item.allocated.amount;
    const state = edits[item.transaction.id] ?? {
      checked: allocated > 0,
      amount: allocated,
    };
    return { item, ...state };
  });
  const totals = allocationTotals(rows, inflow);
  const statusRows = rows.map((row) => ({
    description: row.item.transaction.description,
    checked: row.checked,
    amount: row.amount,
    remaining: row.item.remaining.amount,
  }));
  // The rows decide whether the submit is on; a submit error only takes the line over.
  const valid = statusLine(statusRows, totals.leftover, null);
  const status = statusLine(statusRows, totals.leftover, error);
  const ready = rows.some((row) => row.checked) && valid.tone === "muted";
  const hadLinks = items.some((item) => item.allocated.amount > 0);
  const currency = transaction.balancing_currency;

  const change = useStableCallback((next: boolean) => {
    if (!next) {
      setEdits({});
      setCategoryId(null);
      setError(null);
    }

    onOpenChange(next);
  });

  const send = (
    allocations: Allocation[],
    doneKey: "reimbursement.done" | "reimbursement.cleared",
  ) => {
    setError(null);
    reimburse
      .mutateAsync({ current: transaction, allocations })
      .then(() => {
        change(false);
        toast.show({ tone: "success", title: t(doneKey) });
      })
      .catch((caught: unknown) => {
        setError(reimbursementErrorText(caught, t));
      });
  };

  function toggle(row: DraftRow, next: boolean) {
    const others = totals.allocated - (row.checked ? row.amount : 0);
    const amount = next
      ? fillAllocation(row.item.remaining.amount, inflow - others)
      : row.amount;
    setEdits({
      ...edits,
      [row.item.transaction.id]: { checked: next, amount },
    });
  }

  function setAmount(row: DraftRow, amount: number) {
    setEdits({
      ...edits,
      [row.item.transaction.id]: { checked: row.checked, amount },
    });
  }

  // RD8: each suggested expense with what it still needs; together they make the inflow.
  function checkAll(ids: readonly string[]) {
    const next = { ...edits };
    for (const row of rows) {
      if (ids.includes(row.item.transaction.id))
        next[row.item.transaction.id] = {
          checked: true,
          amount: row.item.remaining.amount,
        };
    }

    setEdits(next);
  }

  function submit() {
    send(
      rows
        .filter((row) => row.checked)
        .map((row) => ({
          original_id: row.item.transaction.id,
          amount: { amount: row.amount, currency },
          ...(categoryId === null ? {} : { category_id: categoryId }),
        })),
      "reimbursement.done",
    );
  }

  function clear() {
    send([], "reimbursement.cleared");
  }

  return {
    rows,
    totals,
    status,
    ready,
    hadLinks,
    pending: reimburse.isPending,
    categoryId,
    setCategoryId,
    change,
    toggle,
    setAmount,
    checkAll,
    submit,
    clear,
  };
}
