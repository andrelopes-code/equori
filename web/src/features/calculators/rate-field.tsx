import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import type { ReactNode } from "react";

import { RateInput } from "@/ui/rate-input";
import type { RatePeriod } from "@/ui/rate-input";

// A rate in percent under its label, with an optional period, a hint and a note below it.
export function RateField({
  label,
  hint,
  name,
  value,
  onChange,
  period,
  onPeriodChange,
  children,
}: {
  label: string;
  hint?: string;
  name: string;
  value: string;
  onChange: (text: string) => void;
  period?: RatePeriod;
  onPeriodChange?: (period: RatePeriod) => void;
  children?: ReactNode;
}) {
  return (
    <Field necessity="none">
      <FieldLabel>{label}</FieldLabel>
      <RateInput
        name={name}
        value={value}
        onChange={onChange}
        {...(period === undefined ? {} : { period })}
        {...(onPeriodChange === undefined ? {} : { onPeriodChange })}
      />
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
      {children}
    </Field>
  );
}
