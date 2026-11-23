import { Field, FieldDescription } from "@slotted/react/field";
import type { ReactNode } from "react";

import design from "@/features/calculators/calculator-frame/calculator-design.module.css";
import { rateFieldValue } from "@/features/calculators/fields/rate-field-value";
import { useAppLocale } from "@/i18n/i18n-provider";
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
  const [tag] = useAppLocale();

  return (
    <Field necessity="none" {...(compact ? { width: "medium" } : {})}>
      <FieldTitle label={label} {...(help === undefined ? {} : { help })} />
      <RateInput
        name={name}
        value={rateFieldValue(value, tag)}
        onChange={onChange}
        {...(compact ? { valueClassName: design.unitValue } : {})}
        {...(period === undefined ? {} : { period })}
        {...(onPeriodChange === undefined ? {} : { onPeriodChange })}
      />
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
      {children}
    </Field>
  );
}
