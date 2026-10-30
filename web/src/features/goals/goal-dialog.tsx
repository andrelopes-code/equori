import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectControl,
  MultiSelectItem,
} from "@slotted/react/multi-select";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import type { Goal } from "@/features/goals/goal-line";
import { goalAccounts, withoutNesting } from "@/features/goals/goal-accounts";
import { useCreateGoal, useUpdateGoal } from "@/features/planning";
import { settingsQuery, useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { MoneyInput } from "@/ui/money-input";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

// A goal is a target balance, in the base currency, over open asset accounts by a date. With a
// goal the dialog edits it, and the target keeps the goal's own currency.
export function GoalDialog({
  goal,
  onDone,
  onCancel,
}: {
  goal?: Goal;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const write = goal === undefined ? create : update;
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const scale = useScale();
  const currency = goal?.target.currency ?? settings.data?.base_currency;
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal?.target.amount ?? 0);
  const [dueOn, setDueOn] = useState(
    () => goal?.due_on ?? shiftDate(today, 365),
  );
  const [accountIDs, setAccountIDs] = useState<readonly string[]>(
    goal?.account_ids ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const choices = withoutNesting(
    goalAccounts(accounts.data ?? []),
    accounts.data ?? [],
    accountIDs,
  );
  // Every account, so a tag names an account the list no longer offers, such as a closed one.
  const names = (accounts.data ?? []).map((a) => ({
    value: a.id,
    label: a.name,
  }));
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(goal === undefined ? "goals.new" : "goals.editTitle")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const next: Record<string, string> = {};
              if (name.trim() === "") next.name = t("goals.problem.name");
              if (target <= 0) next.target = t("goals.problem.target");
              if (accountIDs.length === 0)
                next.account_ids = t("goals.problem.accounts");
              setErrors(next);
              setSummary(null);
              if (Object.keys(next).length > 0 || currency === undefined)
                return;
              const body = {
                name: name.trim(),
                target: { amount: target, currency },
                due_on: dueOn,
                account_ids: [...accountIDs],
              };
              (goal === undefined
                ? create.mutateAsync(body)
                : update.mutateAsync({ id: goal.id, goal: body })
              )
                .then(onDone)
                .catch((caught: unknown) => {
                  if (caught instanceof ProblemError)
                    setErrors(fieldErrors(caught.problem));
                  setSummary(errorText(caught, t));
                });
            }}
          >
            <FormLayout>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}

              <Field invalid={errors.name !== undefined} required>
                <FieldLabel>{t("goals.name")}</FieldLabel>
                <TextField
                  value={name}
                  maxLength={60}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
                {errors.name !== undefined && (
                  <FieldError>{errors.name}</FieldError>
                )}
              </Field>

              <FormRow>
                <Field invalid={errors.target !== undefined} required>
                  <FieldLabel>{t("goals.target")}</FieldLabel>
                  {currency !== undefined && scale !== null && (
                    <MoneyInput
                      size="field"
                      value={target}
                      onChange={setTarget}
                      currency={currency}
                      scale={scale(currency)}
                      sign="neutral"
                    />
                  )}

                  {errors.target !== undefined && (
                    <FieldError>{errors.target}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.due_on !== undefined} required>
                  <FieldLabel>{t("goals.due")}</FieldLabel>
                  <DateInput
                    className={widths.fill}
                    name="due_on"
                    value={dueOn}
                    onChange={setDueOn}
                    shortcuts={false}
                    min={today}
                  />
                  {errors.due_on !== undefined && (
                    <FieldError>{errors.due_on}</FieldError>
                  )}
                </Field>
              </FormRow>

              <Field invalid={errors.account_ids !== undefined} required>
                <FieldLabel>{t("goals.accounts")}</FieldLabel>
                <MultiSelect
                  value={accountIDs}
                  items={names}
                  onValueChange={setAccountIDs}
                >
                  <MultiSelectControl placeholder={t("goals.accountsHint")} />
                  <MultiSelectContent>
                    {choices.map((account) => (
                      <MultiSelectItem key={account.id} value={account.id}>
                        {account.name}
                      </MultiSelectItem>
                    ))}
                  </MultiSelectContent>
                </MultiSelect>
                {errors.account_ids !== undefined && (
                  <FieldError>{errors.account_ids}</FieldError>
                )}
              </Field>
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={write.isPending}
            disabled={currency === undefined}
          >
            {t(goal === undefined ? "goals.create" : "goals.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
