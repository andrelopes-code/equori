import { Field, FieldDescription } from "@slotted/react/field";
import type { ReactNode } from "react";

import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { MoneyInput } from "@/ui/money/money-input";

// An amount of the base currency, held in the address as minor units; absent reads as zero.
export function AmountField({
  label,
  hint,
  help,
  width,
  value,
  onChange,
  money,
  children,
}: {
  label: string;
  // What the amount is, in one sentence, below the input.
  hint?: string;
  // The definition of the term, beside the label (F8).
  help?: string;
  // The width step of forms F3: an amount stands at "medium".
  width?: "short" | "medium";
  value: string | undefined;
  onChange: (minorText: string | undefined) => void;
  money: CalculatorMoney;
  // A note below the input, such as the origin of a filled value.
  children?: ReactNode;
}) {
  const minor = value === undefined ? 0 : Number(value);
  return (
    <Field necessity="none" {...(width === undefined ? {} : { width })}>
      <FieldTitle label={label} {...(help === undefined ? {} : { help })} />
      <MoneyInput
        size="field"
        value={Number.isSafeInteger(minor) && minor >= 0 ? minor : 0}
        onChange={(next) => {
          onChange(next === 0 ? undefined : String(next));
        }}
        currency={money.currency}
        scale={money.scale}
        sign="neutral"
      />
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
      {children}
    </Field>
  );
}
