import { Field, FieldLabel } from "@slotted/react/field";

import { CsvColumnField } from "@/features/accounts/csv-column-field";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormRow } from "@/ui/form-row";

interface CsvDateFieldsProps {
  headers: string[];
  value: ProfileDraft;
  onChange: (patch: ProfileDraft) => void;
}

export function CsvDateFields({
  headers,
  value,
  onChange,
}: CsvDateFieldsProps) {
  const t = useT();

  return (
    <FormRow>
      <CsvColumnField
        label={t("importFile.dateColumn")}
        field="date_column"
        headers={headers}
        value={value}
        onChange={onChange}
      />
      <Field required width="medium">
        <FieldLabel>{t("importFile.dateLayout")}</FieldLabel>
        <ChoiceSelect
          label={t("importFile.dateLayout")}
          choices={["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"].map((l) => ({
            value: l,
            label: l,
          }))}
          value={value.date_layout ?? null}
          multiple={false}
          onChange={(next) => {
            if (
              next === "DD/MM/YYYY" ||
              next === "YYYY-MM-DD" ||
              next === "MM/DD/YYYY"
            ) {
              onChange({ date_layout: next });
            }
          }}
        />
      </Field>
    </FormRow>
  );
}
