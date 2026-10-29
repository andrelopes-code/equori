import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import type { PostingKind } from "@/features/transactions/entry-kind";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";

export interface EntryAmountFieldProps {
  kind: PostingKind;
  value: number;
  currency: string;
  scale: number;
  error: string | undefined;
  autoFocus: boolean;
  onChange: (amount: number) => void;
}

// The amount of a simple entry, signed by its kind.
export function EntryAmountField({
  kind,
  value,
  currency,
  scale,
  error,
  autoFocus,
  onChange,
}: EntryAmountFieldProps) {
  const t = useT();

  return (
    <Field invalid={error !== undefined}>
      <FieldLabel>{t("entry.amount")}</FieldLabel>
      <MoneyInput
        value={value}
        currency={currency}
        scale={scale}
        sign={
          kind === "expense"
            ? "expense"
            : kind === "income"
              ? "income"
              : "neutral"
        }
        autoFocus={autoFocus}
        onChange={onChange}
      />
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  );
}
