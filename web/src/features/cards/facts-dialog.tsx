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
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useSetStatementFacts } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type Statement = components["schemas"]["StatementSummary"];

// A85, A86: the statement as the institution printed it; the owner's facts win over an
// aggregator's, and purchases the new dates move are billed again.
export function FactsDialog({
  statement,
  scale,
  onDone,
  onCancel,
}: {
  statement: Statement;
  scale: (code: string) => number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const save = useSetStatementFacts();
  const currency = statement.amount_due.currency;
  const known = statement.institution;
  const [closing, setClosing] = useState(
    known?.closing_date ?? statement.closing_date,
  );
  const [due, setDue] = useState(known?.due_date ?? statement.due_date);
  const [total, setTotal] = useState(known?.total.amount ?? 0);
  const [minimum, setMinimum] = useState(known?.minimum?.amount ?? 0);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("facts.title")}</DialogTitle>
          <DialogDescription>{t("facts.moveHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (total === 0) return;
              setError(null);
              save
                .mutateAsync({
                  id: statement.id,
                  body: {
                    closing_date: closing,
                    due_date: due,
                    total: { amount: total, currency },
                    ...(minimum > 0
                      ? { minimum: { amount: minimum, currency } }
                      : {}),
                  },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            <FormLayout>
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}

              <Field>
                <FieldLabel>{t("facts.total")}</FieldLabel>
                <MoneyInput
                  size="field"
                  className={widths.medium}
                  value={total}
                  onChange={setTotal}
                  currency={currency}
                  scale={scale(currency)}
                  sign="neutral"
                />
              </Field>

              <Field>
                <FieldLabel>{t("facts.minimum")}</FieldLabel>
                <MoneyInput
                  size="field"
                  className={widths.medium}
                  value={minimum}
                  onChange={setMinimum}
                  currency={currency}
                  scale={scale(currency)}
                  sign="neutral"
                />
              </Field>

              <Field>
                <FieldLabel>{t("facts.closing")}</FieldLabel>
                <DateInput
                  name="closing_date"
                  value={closing}
                  onChange={setClosing}
                  shortcuts={false}
                />
              </Field>

              <Field>
                <FieldLabel>{t("facts.due")}</FieldLabel>
                <DateInput
                  name="due_date"
                  value={due}
                  onChange={setDue}
                  shortcuts={false}
                />
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
            disabled={total === 0}
            loading={save.isPending}
          >
            {t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
