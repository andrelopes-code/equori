import { Field, FieldLabel } from "@slotted/react/field";
import { useMemo } from "react";

import { CsvColumnField } from "@/features/accounts/csv/csv-column-field";
import { dateLayoutChoices } from "@/features/accounts/csv/csv-guess";
import type { ProfileDraft } from "@/features/accounts/csv/csv-guess";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormRow } from "@/ui/form-layout/form-row";

interface CsvDateFieldsProps {
  text: string;
  headers: string[];
  value: ProfileDraft;
  onChange: (patch: ProfileDraft) => void;
}

export function CsvDateFields({
  text,
  headers,
  value,
  onChange,
}: CsvDateFieldsProps) {
  const t = useT();

  const layouts = useMemo(() => dateLayoutChoices(text, value), [text, value]);

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
          choices={layouts.map((l) => ({ value: l, label: l }))}
          value={value.date_layout ?? null}
          multiple={false}
          onChange={(next) => {
            if (typeof next === "string") onChange({ date_layout: next });
          }}
        />
      </Field>
    </FormRow>
  );
}
