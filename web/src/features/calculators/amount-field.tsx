import { Field, FieldLabel } from "@slotted/react/field";
import type { ReactNode } from "react";

import type { CalculatorMoney } from "@/features/calculators/use-calculator-money";
import { MoneyInput } from "@/ui/money-input";

// An amount of the base currency, held in the address as minor units; absent reads as zero.
export function AmountField({
  label,
  value,
  onChange,
  money,
  children,
}: {
  label: string;
  value: string | undefined;
  onChange: (minorText: string | undefined) => void;
  money: CalculatorMoney;
  // A note below the input, such as the origin of a filled value.
  children?: ReactNode;
}) {
  const minor = value === undefined ? 0 : Number(value);
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <MoneyInput
        value={Number.isSafeInteger(minor) && minor >= 0 ? minor : 0}
        onChange={(next) => {
          onChange(next === 0 ? undefined : String(next));
        }}
        currency={money.currency}
        scale={money.scale}
        sign="neutral"
      />
      {children}
    </Field>
  );
}
