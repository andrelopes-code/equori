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
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { usePayStatement } from "@/features/cards/api";
import { AccountField } from "@/features/transactions";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { MoneyInput } from "@/ui/money-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementSummary"];

// M08: a statement paid from a balance account; the lines under the form say what the statement
// and the account become before the confirm (FM-14).
export function PayDialog({
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
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();
  const formId = useId();
  const accounts = useQuery(accountsQuery(useApi()));
  const pay = usePayStatement();
  const currency = statement.unpaid.currency;
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState<string | null>(null);
  const [amount, setAmount] = useState(statement.unpaid.amount);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const money = (value: number) =>
    fmt.money({ amount: value, currency }, scale(currency));
  const minimum = statement.institution?.minimum;
  const presets = [
    {
      key: "unpaid",
      label: t("pay.preset.unpaid"),
      value: statement.unpaid.amount,
    },
    ...(minimum === undefined
      ? []
      : [
          {
            key: "minimum",
            label: t("pay.preset.minimum"),
            value: minimum.amount,
          },
        ]),
  ];
  const left = statement.unpaid.amount - amount;
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("pay.title", {
              month: formatMonthTitle(statement.reference, locale),
            })}
          </DialogTitle>
          <DialogDescription>{t("pay.hint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (from === null || amount === 0) return;
              setError(null);
              pay
                .mutateAsync({
                  id: statement.id,
                  body: {
                    date,
                    from_account_id: from,
                    amount: { amount, currency },
                  },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            <Stack gap={4}>
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}
              <Field>
                <FieldLabel>{t("pay.amount")}</FieldLabel>
                <MoneyInput
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                  scale={scale(currency)}
                  sign="neutral"
                />
                <Inline gap={2}>
                  {presets.map((preset) => (
                    <Button
                      key={preset.key}
                      size="sm"
                      variant={amount === preset.value ? "solid" : "outline"}
                      tone={amount === preset.value ? "accent" : "secondary"}
                      aria-pressed={amount === preset.value}
                      onClick={() => {
                        setAmount(preset.value);
                      }}
                    >
                      {t("pay.presetWith", {
                        label: preset.label,
                        amount: money(preset.value),
                      })}
                    </Button>
                  ))}
                </Inline>
              </Field>
              {accounts.data !== undefined && (
                <Field>
                  <FieldLabel>{t("pay.from")}</FieldLabel>
                  <AccountField
                    accounts={accounts.data}
                    value={from}
                    onChange={setFrom}
                    exclude={statement.account_id}
                    name="from_account_id"
                    title={t("pay.from")}
                    amount={amount}
                    direction="out"
                    date={date}
                    categoryId={null}
                    payeeId={null}
                    kind="transfer"
                    currency={currency}
                    scale={scale}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel>{t("pay.date")}</FieldLabel>
                <DateInput name="date" value={date} onChange={setDate} />
              </Field>
              {amount > 0 && (
                <Text size="sm" role="status">
                  {left <= 0
                    ? t("pay.paysAll")
                    : t("pay.leaves", { amount: money(left) })}
                </Text>
              )}
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={from === null || amount === 0}
            loading={pay.isPending}
          >
            {t("pay.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
