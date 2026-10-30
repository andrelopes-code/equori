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
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useFinanceStatement } from "@/features/cards/api";
import { financingInterest } from "@/features/cards/card-math";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementSummary"];

const counts = Array.from({ length: 23 }, (_, i) => i + 2);

// M09: the unpaid amount of a closed statement turned into installments; the total and the
// interest it costs stand under the fields as they are typed.
export function FinanceDialog({
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
  const fmt = useMoneyFormat();
  const today = useToday();
  const formId = useId();
  const finance = useFinanceStatement();
  const currency = statement.unpaid.currency;
  const [date, setDate] = useState(today);
  const [count, setCount] = useState(10);
  const [each, setEach] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const money = (value: number) =>
    fmt.money({ amount: value, currency }, scale(currency));
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("finance.title")}</DialogTitle>
          <DialogDescription>
            {t("finance.hint", { amount: money(statement.unpaid.amount) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (each === 0) return;
              setError(null);
              finance
                .mutateAsync({
                  id: statement.id,
                  body: {
                    date,
                    installment_count: count,
                    installment_amount: { amount: each, currency },
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

              <FormRow>
                <Field required>
                  <FieldLabel>{t("finance.count")}</FieldLabel>
                  <ChoiceSelect
                    label={t("finance.count")}
                    choices={counts.map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                    value={String(count)}
                    multiple={false}
                    onChange={(next) => {
                      if (typeof next === "string") setCount(Number(next));
                    }}
                  />
                </Field>

                <Field required>
                  <FieldLabel>{t("finance.installment")}</FieldLabel>
                  <MoneyInput
                    size="field"
                    value={each}
                    onChange={setEach}
                    currency={currency}
                    scale={scale(currency)}
                    sign="neutral"
                  />
                  {each > 0 && (
                    <FieldDescription live="polite">
                      {t("finance.interest", {
                        total: money(count * each),
                        interest: money(
                          financingInterest(
                            count,
                            each,
                            statement.unpaid.amount,
                          ),
                        ),
                      })}
                    </FieldDescription>
                  )}
                </Field>
              </FormRow>

              <Field required>
                <FieldLabel>{t("finance.date")}</FieldLabel>
                <DateInput
                  name="date"
                  className={widths.fill}
                  value={date}
                  onChange={setDate}
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
            disabled={each === 0}
            loading={finance.isPending}
          >
            {t("finance.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
