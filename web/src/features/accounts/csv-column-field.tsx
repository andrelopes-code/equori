import { Field, FieldLabel } from "@slotted/react/field";

import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

const none = "";

interface CsvColumnFieldProps {
  label: string;
  field:
    | "date_column"
    | "description_column"
    | "amount_column"
    | "debit_column"
    | "credit_column"
    | "id_column";
  optional?: boolean;
  headers: string[];
  value: ProfileDraft;
  onChange: (patch: ProfileDraft) => void;
}

export function CsvColumnField({
  label,
  field,
  optional = false,
  headers,
  value,
  onChange,
}: CsvColumnFieldProps) {
  const t = useT();
  const columns = headers.map((h) => ({ value: h, label: h }));

  return (
    <Field required={!optional}>
      <FieldLabel>{label}</FieldLabel>
      <ChoiceSelect
        label={label}
        choices={
          optional
            ? [{ value: none, label: t("importFile.noColumn") }, ...columns]
            : columns
        }
        value={value[field] ?? (optional ? none : null)}
        multiple={false}
        onChange={(next) => {
          onChange({
            [field]:
              typeof next === "string" && next !== none ? next : undefined,
          });
        }}
      />
    </Field>
  );
}
