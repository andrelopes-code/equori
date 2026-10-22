import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { CategoryPicker, useCategoryEntries } from "@/features/categories";
import {
  reimbursementCandidatesQuery,
  useReimburseTransaction,
} from "@/features/transactions/api";
import {
  allocationTotals,
  fillAllocation,
  reimbursementState,
} from "@/features/transactions/reimbursement";
import { reimbursementErrorText } from "@/features/transactions/reimbursement-error";
import { ReimbursementRow } from "@/features/transactions/reimbursement-row";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

interface RowState {
  checked: boolean;
  amount: number;
}

// A117: the inflow repays the expenses the reader checks, each with its own amount; the rest of
// the inflow stays income. The list is sent whole and replaces the earlier one.
export function ReimbursementDialog({
  transaction,
  accounts,
  scale,
  open,
  onOpenChange,
}: {
  transaction: Transaction;
  accounts: readonly Account[];
  scale: (code: string) => number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const reimburse = useReimburseTransaction();
  const candidates = useQuery({
    ...reimbursementCandidatesQuery(api, transaction.id),
    enabled: open,
  });
  const entries = useCategoryEntries(accounts);
  const incomeIds = useMemo(
    () => new Set(entries.filter((e) => e.class === "income").map((e) => e.id)),
    [entries],
  );
  const inflow = reimbursementState(
    transaction,
    new Map(accounts.map((a) => [a.id, a])),
  ).amount;
  const [edits, setEdits] = useState<Record<string, RowState>>({});
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = candidates.data?.items ?? [];
  const rows = items.map((item) => {
    const allocated = item.allocated.amount;
    return {
      item,
      state: edits[item.transaction.id] ?? {
        checked: allocated > 0,
        amount: allocated,
      },
    };
  });
  const totals = allocationTotals(
    rows.map((r) => r.state),
    inflow,
  );
  const checked = rows.filter((r) => r.state.checked);
  const valid =
    checked.length > 0 &&
    totals.leftover >= 0 &&
    checked.every(
      (r) => r.state.amount > 0 && r.state.amount <= r.item.remaining.amount,
    );
  const hadLinks = items.some((i) => i.allocated.amount > 0);
  const currency = transaction.balancing_currency;
  const fmt = (minor: number) =>
    formatMoney({ amount: minor, currency }, scale(currency), locale);

  const change = useStableCallback((next: boolean) => {
    if (!next) {
      setEdits({});
      setCategoryId(null);
      setError(null);
    }
    onOpenChange(next);
  });
  const send = (
    allocations: components["schemas"]["ReimbursementAllocation"][],
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
  return (
    <Dialog open={open} onOpenChange={change} size="md">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reimbursement.title")}</DialogTitle>
          <DialogDescription>
            {t("reimbursement.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {candidates.isSuccess && items.length === 0 && (
            <InlineMessage>{t("reimbursement.empty")}</InlineMessage>
          )}
          {items.length > 0 && (
            <Field>
              <FieldLabel>{t("reimbursement.expenses")}</FieldLabel>
              {rows.map(({ item, state }) => (
                <ReimbursementRow
                  key={item.transaction.id}
                  candidate={item}
                  checked={state.checked}
                  amount={state.amount}
                  scale={scale}
                  onCheckedChange={(next) => {
                    const others =
                      totals.allocated - (state.checked ? state.amount : 0);
                    setEdits({
                      ...edits,
                      [item.transaction.id]: {
                        checked: next,
                        amount: next
                          ? fillAllocation(
                              item.remaining.amount,
                              inflow - others,
                            )
                          : state.amount,
                      },
                    });
                  }}
                  onAmountChange={(minor) => {
                    setEdits({
                      ...edits,
                      [item.transaction.id]: { ...state, amount: minor },
                    });
                  }}
                />
              ))}
            </Field>
          )}
          {items.length > 0 && (
            <InlineMessage tone={totals.leftover < 0 ? "danger" : "secondary"}>
              {t("reimbursement.totals", {
                allocated: fmt(totals.allocated),
                total: fmt(inflow),
                leftover: fmt(totals.leftover),
              })}
            </InlineMessage>
          )}
          {items.length > 0 && (
            <Field>
              <FieldLabel>{t("reimbursement.category")}</FieldLabel>
              <CategoryPicker
                aria-label={t("reimbursement.category")}
                value={categoryId}
                amount={-1}
                exclude={incomeIds}
                onChange={setCategoryId}
              />
              <FieldDescription>
                {t("reimbursement.categoryHint")}
              </FieldDescription>
            </Field>
          )}
          {error !== null && (
            <InlineMessage tone="danger">{error}</InlineMessage>
          )}
        </DialogBody>
        <DialogFooter>
          {hadLinks && (
            <Button
              variant="ghost"
              tone="danger"
              loading={reimburse.isPending}
              onClick={() => {
                send([], "reimbursement.cleared");
              }}
            >
              {t("reimbursement.clear")}
            </Button>
          )}
          <Button
            variant="ghost"
            tone="secondary"
            onClick={() => {
              change(false);
            }}
          >
            {t("detail.cancel")}
          </Button>
          <Button
            loading={reimburse.isPending}
            disabled={!valid}
            onClick={() => {
              send(
                checked.map((r) => ({
                  original_id: r.item.transaction.id,
                  amount: { amount: r.state.amount, currency },
                  ...(categoryId === null ? {} : { category_id: categoryId }),
                })),
                "reimbursement.done",
              );
            }}
          >
            {t("reimbursement.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
