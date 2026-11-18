import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { Goal } from "@/features/goals/goal-card/goal-line";
import { useAllocateToGoal } from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { MoneyInput } from "@/ui/money/money-input";

interface GoalAllocateDialogProps {
  goal: Goal;
  // release takes an amount back from the goal; aside sets one apart for it.
  mode: "aside" | "release";
  scale: (code: string) => number;
  names: ReadonlyMap<string, string>;
  onDone: () => void;
  onCancel: () => void;
}

// Sets aside a part of a shared account for a goal, or releases it (planning coherence A255):
// no money moves, the amount changes hands between the goal and what the account has available.
export function GoalAllocateDialog({
  goal,
  mode,
  scale,
  names,
  onDone,
  onCancel,
}: GoalAllocateDialogProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const overlayOpen = useOverlayOpen();
  const allocate = useAllocateToGoal();
  const [accountID, setAccountID] = useState(
    goal.allocated_accounts[0]?.account_id ?? "",
  );
  const [amount, setAmount] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const account = goal.allocated_accounts.find(
    (a) => a.account_id === accountID,
  );
  if (account === undefined) return null;

  const currency = account.allocated.currency;
  const name = names.get(accountID) ?? "";
  const limit = mode === "aside" ? account.available : account.allocated;
  const hint = t(
    mode === "aside" ? "goals.allocate.available" : "goals.allocate.held",
    { amount: fmt.money(limit, scale(currency)), account: name },
  );

  const handleSubmit = () => {
    setError(null);
    setProblem(amount > 0 ? null : t("goals.problem.amount"));
    if (amount <= 0) return;

    allocate
      .mutateAsync({
        goal: goal.id,
        allocation: {
          account_id: accountID,
          amount: { amount: mode === "aside" ? amount : -amount, currency },
        },
      })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  };

  return (
    <Dialog
      open={overlayOpen}
      size="sm"
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                mode === "aside"
                  ? "goals.allocate.title"
                  : "goals.release.title",
                { name: goal.name },
              )}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormLayout>
              {error !== null && <FormNotice>{error}</FormNotice>}

              {goal.allocated_accounts.length > 1 && (
                <ChoiceSelect
                  label={t("goals.allocate.account")}
                  multiple={false}
                  value={accountID}
                  choices={goal.allocated_accounts.map((a) => ({
                    value: a.account_id,
                    label: names.get(a.account_id) ?? "",
                  }))}
                  onChange={(next) => {
                    if (typeof next === "string") setAccountID(next);
                  }}
                />
              )}

              <Field invalid={problem !== null} required>
                <FieldLabel>{t("goals.allocate.amount")}</FieldLabel>
                <MoneyInput
                  size="field"
                  value={amount}
                  currency={currency}
                  scale={scale(currency)}
                  sign="neutral"
                  onChange={setAmount}
                />
                <FieldDescription>{hint}</FieldDescription>
                {problem !== null && <FieldError>{problem}</FieldError>}
              </Field>
            </FormLayout>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={allocate.isPending}>
              {t(mode === "aside" ? "goals.setAside" : "goals.release")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
