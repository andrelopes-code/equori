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
import { Stack } from "@slotted/react/stack";
import { useId, useState } from "react";

import { ProblemError, errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useReconcileStatement } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementSummary"];

// A7: the institution's total confirms the statement when it equals the ledger's; a different one
// leaves the difference, and the institution's facts are where to record it.
export function ReconcileDialog({
  statement,
  scale,
  onDone,
  onFacts,
  onCancel,
}: {
  statement: Statement;
  scale: (code: string) => number;
  onDone: () => void;
  onFacts: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const fmt = useMoneyFormat();
  const formId = useId();
  const reconcile = useReconcileStatement();
  const currency = statement.amount_due.currency;
  const [amount, setAmount] = useState(
    statement.institution?.total.amount ?? statement.amount_due.amount,
  );
  const [differs, setDiffers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reconcileStatement.title")}</DialogTitle>
          <DialogDescription>
            {t("reconcileStatement.hint", {
              amount: fmt.money(statement.amount_due, scale(currency)),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setDiffers(false);
              reconcile
                .mutateAsync({
                  id: statement.id,
                  amountDue: { amount, currency },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  if (
                    caught instanceof ProblemError &&
                    caught.problem.code === "difference_remains"
                  ) {
                    setDiffers(true);
                    setError(
                      t("reconcileStatement.differs", {
                        amount: fmt.money(
                          {
                            amount: amount - statement.amount_due.amount,
                            currency,
                          },
                          scale(currency),
                        ),
                      }),
                    );
                    return;
                  }
                  setError(errorText(caught, t));
                });
            }}
          >
            <Stack gap={4}>
              {error !== null && (
                <InlineMessage tone="warning">{error}</InlineMessage>
              )}
              <Field>
                <FieldLabel>{t("reconcileStatement.amount")}</FieldLabel>
                <MoneyInput
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                  scale={scale(currency)}
                  sign="neutral"
                />
              </Field>
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          {differs && (
            <Button variant="outline" onClick={onFacts}>
              {t("statement.facts")}
            </Button>
          )}
          <Button type="submit" form={formId} loading={reconcile.isPending}>
            {t("reconcileStatement.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
