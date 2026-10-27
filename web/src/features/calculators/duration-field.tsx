import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { TextField } from "@slotted/react/text-field";

import type { DurationUnit } from "@/features/calculators/duration";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

const unitKeys = {
  day: "calc.unit.days",
  month: "calc.unit.months",
  year: "calc.unit.years",
} as const;

// A term typed in the unit the reader thinks in: a loan in years, a deposit in months, a
// security in days. The unit sits beside the number, as the period sits beside a rate.
export function DurationField({
  label,
  hint,
  name,
  value,
  onChange,
  unit,
  units,
  onUnitChange,
}: {
  label: string;
  hint?: string;
  name: string;
  value: string;
  onChange: (text: string) => void;
  unit: DurationUnit;
  units: readonly DurationUnit[];
  onUnitChange: (unit: DurationUnit) => void;
}) {
  const t = useT();
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Inline gap={2} wrap="nowrap">
        <TextField
          name={name}
          inputMode={unit === "year" ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onChange(event.target.value.replace(",", "."));
          }}
        />
        <ChoiceSelect
          label={t("calc.unit")}
          choices={units.map((u) => ({ value: u, label: t(unitKeys[u]) }))}
          value={unit}
          multiple={false}
          onChange={(next) => {
            const chosen = units.find((u) => u === next);
            if (chosen !== undefined) onUnitChange(chosen);
          }}
        />
      </Inline>
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
