import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { typeLabel } from "@/features/instruments/model/instrument-labels";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type InstrumentType = components["schemas"]["InstrumentType"];

interface InstrumentTypeFieldProps {
  stored: InstrumentType;
  value: InstrumentType;
  error: string | undefined;
  onChange: (next: InstrumentType) => void;
}

// A222 A224: the types a security changes among; the same list as `ReclassifiableTypes` in
// `internal/marketdata/domain/instrument.go`.
export const reclassifiableTypes: readonly InstrumentType[] = [
  "stock",
  "etf",
  "reit",
  "depositary_receipt",
];

export function InstrumentTypeField({
  stored,
  value,
  error,
  onChange,
}: InstrumentTypeFieldProps) {
  const t = useT();

  if (!reclassifiableTypes.includes(stored)) return null;

  return (
    <Field invalid={error !== undefined}>
      <FieldLabel>{t("instruments.field.type")}</FieldLabel>
      <ChoiceSelect
        label={t("instruments.field.type")}
        choices={reclassifiableTypes.map((type) => ({
          value: type,
          label: typeLabel(t, type),
        }))}
        value={value}
        multiple={false}
        onChange={(next) => {
          const type = reclassifiableTypes.find(
            (candidate) => candidate === next,
          );
          if (type !== undefined) onChange(type);
        }}
      />
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  );
}
