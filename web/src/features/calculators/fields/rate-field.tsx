import { Field, FieldDescription } from "@slotted/react/field";
import type { ReactNode } from "react";

import design from "@/features/calculators/calculator-frame/calculator-design.module.css";
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
  compact = false,
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
  // The value-and-unit layout of the answer-first frame: a 7rem number beside its period select.
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <Field necessity="none">
      <FieldTitle label={label} {...(help === undefined ? {} : { help })} />
      <RateInput
        name={name}
        value={value}
        onChange={onChange}
        {...(compact
          ? {
              valueClassName: design.unitValue,
              periodClassName: design.unitSelect,
            }
          : {})}
        {...(period === undefined ? {} : { period })}
        {...(onPeriodChange === undefined ? {} : { onPeriodChange })}
      />
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
      {children}
    </Field>
  );
}
