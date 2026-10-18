import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import type { Entity } from "@slotted/react/entity-picker";
import { toast } from "@slotted/react/toast";
import { useReducer, useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useCategorizeTransaction } from "@/features/transactions/api";
import { SplitEditor } from "@/features/transactions/split-editor";
import {
  formReducer,
  initialForm,
  splitRemainder,
} from "@/features/transactions/transaction-form-reducer";
import type { FormState } from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

export function categoryPostings(
  transaction: Transaction,
  accountsById: Map<string, Account>,
) {
  return transaction.postings.filter((p) => {
    const accountClass = accountsById.get(p.account_id)?.class;
    return accountClass === "expense" || accountClass === "income";
  });
}

// The category lines hold the magnitude of the category postings; the sign is restored when the parts are sent.
function initialLines(
  transaction: Transaction,
  accountsById: Map<string, Account>,
): FormState {
  const postings = categoryPostings(transaction, accountsById);
  const sum = postings.reduce((total, p) => total + p.amount.amount, 0);
  const first = postings[0];
  return {
    ...initialForm(transaction.date),
    mode:
      first !== undefined &&
      accountsById.get(first.account_id)?.class === "income"
        ? "income"
        : "expense",
    amount: Math.abs(sum),
    split: postings.map((p, i) => ({
      key: String(i + 1),
      categoryId: p.account_id,
      amount: Math.abs(p.amount.amount),
    })),
  };
}

// Mounted only while open, so every opening starts from the stored category postings.
export function CategorizeDialog({
  transaction,
  accounts,
  scale,
  onClose,
}: {
  transaction: Transaction;
  accounts: Account[];
  scale: (code: string) => number;
  onClose: () => void;
}) {
  const t = useT();
  const categorize = useCategorizeTransaction();
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const [state, dispatch] = useReducer(formReducer, undefined, () =>
    initialLines(transaction, accountsById),
  );
  const [error, setError] = useState<string | null>(null);
  const postings = categoryPostings(transaction, accountsById);
  const currency =
    postings[0]?.amount.currency ?? transaction.balancing_currency;
  const sign = postings.reduce((s, p) => s + p.amount.amount, 0) < 0 ? -1 : 1;
  const categoryClass = state.mode === "income" ? "income" : "expense";
  const categories: Entity[] = accounts
    .filter((a) => a.class === categoryClass && a.closed_on === undefined)
    .map((a) => ({ id: a.id, label: a.name }));
  const lines = state.split ?? [];
  const complete =
    splitRemainder(state) === 0 &&
    lines.every(
      (l) => l.categoryId !== "" && l.amount !== null && l.amount > 0,
    );

  const submit = async () => {
    setError(null);
    try {
      await categorize.mutateAsync({
        current: transaction,
        parts: lines.map((l) => ({
          account_id: l.categoryId,
          amount: { amount: sign * (l.amount ?? 0), currency },
        })),
      });
    } catch (failure) {
      setError(
        failure instanceof ProblemError
          ? problemMessage(failure.problem, t)
          : t("transaction.failed"),
      );
      return;
    }
    toast.show({ title: t("transaction.categorize.done") });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transaction.categorize.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <SplitEditor
            state={state}
            dispatch={dispatch}
            categories={categories}
            currency={currency}
            scale={scale(currency)}
            minLines={1}
            canUnsplit={false}
          />
          {error !== null && (
            <Alert tone="danger" role="alert">
              <AlertContent>
                <AlertDescription>{error}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button tone="secondary" variant="outline" onClick={onClose}>
            {t("transaction.cancel")}
          </Button>
          <Button
            disabled={!complete || categorize.isPending}
            onClick={() => void submit()}
          >
            {t("transaction.categorize.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
