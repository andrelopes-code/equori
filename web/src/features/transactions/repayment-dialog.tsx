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
import { Field, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  reimbursementSourcesQuery,
  useReimburseTransaction,
} from "@/features/transactions/api";
import {
  expenseState,
  fillAllocation,
} from "@/features/transactions/reimbursement";
import { reimbursementErrorText } from "@/features/transactions/reimbursement-error";
import { formatDate, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

// A117, from the expense: the reader picks the incoming transaction that repaid it. The server
// replaces the allocations of that inflow, so the request carries the ones it already has.
export function RepaymentDialog({
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
  const sources = useQuery({
    ...reimbursementSourcesQuery(api, transaction.id),
    enabled: open,
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const [typed, setTyped] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = sources.data?.items ?? [];
  const selected = items.find((item) => item.transaction.id === chosen);
  const needed = expenseState(
    transaction,
    new Map(accounts.map((a) => [a.id, a])),
  ).remaining;
  const amount =
    typed ?? (selected ? fillAllocation(needed, selected.free.amount) : 0);
  const valid =
    selected !== undefined &&
    amount > 0 &&
    amount <= needed &&
    amount <= selected.free.amount;

  const change = useStableCallback((next: boolean) => {
    if (!next) {
      setChosen(null);
      setTyped(null);
      setError(null);
    }
    onOpenChange(next);
  });
  return (
    <Dialog open={open} onOpenChange={change} size="sm">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("repayment.title")}</DialogTitle>
          <DialogDescription>{t("repayment.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {sources.isSuccess && items.length === 0 && (
            <InlineMessage>{t("repayment.empty")}</InlineMessage>
          )}
          {items.length > 0 && (
            <Field>
              <FieldLabel>{t("repayment.sources")}</FieldLabel>
              <RadioGroup
                value={chosen ?? undefined}
                onValueChange={(value) => {
                  setChosen(value);
                  setTyped(null);
                }}
              >
                {items.map(({ transaction: inflow, free }) => (
                  <Radio
                    key={inflow.id}
                    value={inflow.id}
                    description={t("repayment.option", {
                      date: formatDate(inflow.date, locale),
                      free: formatMoney(free, scale(free.currency), locale),
                    })}
                  >
                    {inflow.description}
                  </Radio>
                ))}
              </RadioGroup>
            </Field>
          )}
          {selected !== undefined && (
            <Field>
              <FieldLabel>{t("repayment.amount")}</FieldLabel>
              <MoneyInput
                value={amount}
                onChange={setTyped}
                currency={selected.free.currency}
                scale={scale(selected.free.currency)}
                sign="neutral"
              />
            </Field>
          )}
          {error !== null && (
            <InlineMessage tone="danger">{error}</InlineMessage>
          )}
        </DialogBody>
        <DialogFooter>
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
              if (selected === undefined) return;
              setError(null);
              const inflow = selected.transaction;
              const kept = inflow.links.flatMap((link) =>
                link.type === "reimbursement_of" && link.amount !== undefined
                  ? [{ original_id: link.target, amount: link.amount }]
                  : [],
              );
              reimburse
                .mutateAsync({
                  current: inflow,
                  allocations: [
                    ...kept,
                    {
                      original_id: transaction.id,
                      amount: { amount, currency: selected.free.currency },
                    },
                  ],
                })
                .then(() => {
                  change(false);
                  toast.show({
                    tone: "success",
                    title: t("repayment.done"),
                  });
                })
                .catch((caught: unknown) => {
                  setError(reimbursementErrorText(caught, t));
                });
            }}
          >
            {t("repayment.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
