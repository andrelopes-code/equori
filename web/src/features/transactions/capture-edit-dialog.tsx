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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { NumberField } from "@slotted/react/number-field";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { problemsOf } from "@/features/transactions/capture-draft";
import type { LineDraft } from "@/features/transactions/capture-draft";
import { TransactionForm } from "@/features/transactions/transaction-form";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import widths from "@/ui/field-width.module.css";

type Account = components["schemas"]["Account"];
type Payee = components["schemas"]["Payee"];

// The form's field each problem stands under (FM-03).
const fieldOfProblem: Partial<Record<MessageKey, string>> = {
  "capture.problem.amount": "amount",
  "capture.problem.account": "account",
  "capture.problem.destination": "to",
  "capture.problem.sameAccount": "to",
  "capture.problem.installments": "installments",
  "capture.problem.rows": "postings",
};

// A line corrected with the transaction form, plus the installment count of a card purchase.
// The dialog holds a copy; Apply hands it back, Cancel drops it.
export function CaptureEditDialog({
  lineNumber,
  initial,
  accounts,
  accountsById,
  payees,
  tags,
  baseCurrency,
  scale,
  onApply,
  onClose,
}: {
  lineNumber: number;
  initial: LineDraft;
  accounts: readonly Account[];
  accountsById: Map<string, Account>;
  payees: readonly Payee[];
  tags: readonly string[];
  baseCurrency: string;
  scale: (code: string) => number;
  onApply: (draft: LineDraft) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const card =
    draft.accountId === null ? undefined : accountsById.get(draft.accountId);
  const installable = draft.kind === "expense" && card?.kind === "credit_card";

  const apply = () => {
    const next = installable ? draft : { ...draft, installments: 0 };
    const problems = problemsOf(next, accountsById);
    if (problems.length > 0) {
      setErrors(
        Object.fromEntries(
          problems.map((key) => [fieldOfProblem[key] ?? "amount", t(key)]),
        ),
      );
      return;
    }
    onApply(next);
  };

  return (
    <Dialog
      open
      size="md"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("capture.editTitle", { line: lineNumber })}
          </DialogTitle>
          <DialogDescription>{t("capture.editDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            <TransactionForm
              draft={draft}
              onChange={(entry) => {
                setDraft({ ...draft, ...entry });
              }}
              accounts={accounts}
              payees={payees}
              tags={tags}
              baseCurrency={baseCurrency}
              scale={scale}
              errors={errors}
            >
              {installable && (
                <Field invalid={errors.installments !== undefined}>
                  <FieldLabel>{t("capture.installments")}</FieldLabel>
                  <NumberField
                    className={widths.short}
                    value={draft.installments === 0 ? 1 : draft.installments}
                    min={1}
                    max={420}
                    onValueChange={(value) => {
                      setDraft({
                        ...draft,
                        installments: value === null || value < 2 ? 0 : value,
                      });
                    }}
                  />
                  <FieldDescription>
                    {t("capture.installmentsHint")}
                  </FieldDescription>
                  {errors.installments !== undefined && (
                    <FieldError>{errors.installments}</FieldError>
                  )}
                </Field>
              )}
            </TransactionForm>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button onClick={apply}>{t("capture.apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
