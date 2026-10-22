import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useCreateCreditLimit } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { MoneyInput } from "@/ui/money-input";

// A new version of the credit limit from a day on; the free limit follows from it.
export function CreditLimitForm({
  accountId,
  currency,
  scale,
  onDone,
  onCancel,
}: {
  accountId: string;
  currency: string;
  scale: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const today = useToday();
  const create = useCreateCreditLimit();
  const [amount, setAmount] = useState(0);
  const [from, setFrom] = useState(today);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label={t("card.newLimit")}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        create
          .mutateAsync({
            accountId,
            limit: { effective_from: from, amount: { amount, currency } },
          })
          .then(onDone)
          .catch((caught: unknown) => {
            setError(errorText(caught, t));
          });
      }}
    >
      <Stack gap={4}>
        <Field>
          <FieldLabel>{t("accountForm.limit")}</FieldLabel>
          <MoneyInput
            value={amount}
            onChange={setAmount}
            currency={currency}
            scale={scale}
            sign="neutral"
          />
        </Field>
        <Field>
          <FieldLabel>{t("card.limitFrom")}</FieldLabel>
          <DateInput name="effective_from" value={from} onChange={setFrom} />
        </Field>
        {error !== null && <InlineMessage tone="danger">{error}</InlineMessage>}
        <Inline gap={3}>
          <Button
            type="submit"
            disabled={amount === 0}
            loading={create.isPending}
          >
            {t("detail.save")}
          </Button>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}
