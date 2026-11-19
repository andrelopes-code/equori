import { Field, FieldDescription } from "@slotted/react/field";
import type { ReactNode } from "react";

import { FieldTitle } from "@/ui/form-fields/field-title";
import { RateInput } from "@/ui/money/rate-input";
import type { RatePeriod } from "@/ui/money/rate-input";

// A rate in percent under its label, with an optional period, a hint and a note below it.
export function RateField({
  label,
  hint,
  help,
  name,
  value,
  onChange,
  period,
  onPeriodChange,
  children,
}: {
  label: string;
  hint?: string;
  help?: string;
  name: string;
  value: string;
  onChange: (text: string) => void;
  period?: RatePeriod;
  onPeriodChange?: (period: RatePeriod) => void;
  children?: ReactNode;
}) {
  return (
    <Field necessity="none">
      <FieldTitle label={label} {...(help === undefined ? {} : { help })} />
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
