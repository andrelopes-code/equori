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
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories";
import { useCreateInstallmentPurchase } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

const counts = Array.from({ length: 47 }, (_, i) => i + 2);

// M05: a card purchase paid in installments, billed one per statement from the purchase's own;
// interest, when there is any, is the total paid beyond the price.
export function InstallmentPurchaseDialog({
  account,
  scale,
  onDone,
  onCancel,
}: {
  account: Account;
  scale: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const fmt = useMoneyFormat();
  const today = useToday();
  const formId = useId();
  const create = useCreateInstallmentPurchase();
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(10);
  const [interest, setInterest] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const money = (amount: number) =>
    fmt.money({ amount, currency: account.currency }, scale);
  // The per-installment amount the reader will see billed; the server spreads the remainder.
  const each = Math.floor((total + interest) / count);
  const ready = total > 0 && category !== null;
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("card.installmentPurchase")}</DialogTitle>
          <DialogDescription>
            {t("installments.hint", { name: account.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!ready) return;
              setError(null);
              create
                .mutateAsync({
                  card_account_id: account.id,
                  date,
                  ...(description.trim() === ""
                    ? {}
                    : { description: description.trim() }),
                  splits: [
                    {
                      account_id: category,
                      amount: { amount: total, currency: account.currency },
                    },
                  ],
                  installment_count: count,
                  ...(interest > 0
                    ? {
                        interest: {
                          amount: interest,
                          currency: account.currency,
                        },
                      }
                    : {}),
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
                <FieldLabel>{t("installments.total")}</FieldLabel>
                <MoneyInput
                  size="field"
                  className={widths.medium}
                  value={total}
                  onChange={setTotal}
                  currency={account.currency}
                  scale={scale}
                  sign="expense"
                />
              </Field>

              <Field>
                <FieldLabel>{t("installments.description")}</FieldLabel>
                <TextField
                  value={description}
                  maxLength={500}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                />
              </Field>

              <Field required>
                <FieldLabel>{t("installments.category")}</FieldLabel>
                <CategoryPicker
                  aria-label={t("installments.category")}
                  value={category}
                  onChange={setCategory}
                  amount={-1}
                  portal={false}
                />
              </Field>

              <Field>
                <FieldLabel>{t("installments.count")}</FieldLabel>
                <ChoiceSelect
                  className={widths.short}
                  label={t("installments.count")}
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
                {total > 0 && (
                  <FieldDescription live="polite">
                    {t("installments.summary", {
                      count,
                      each: money(each),
                      total: money(total + interest),
                    })}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel>{t("installments.interest")}</FieldLabel>
                <MoneyInput
                  size="field"
                  className={widths.medium}
                  value={interest}
                  onChange={setInterest}
                  currency={account.currency}
                  scale={scale}
                  sign="neutral"
                />
                <FieldDescription>
                  {t("installments.interestHint")}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>{t("installments.date")}</FieldLabel>
                <DateInput name="date" value={date} onChange={setDate} />
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
            disabled={!ready}
            loading={create.isPending}
          >
            {t("installments.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
