import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";

import { CsvColumnField } from "@/features/accounts/csv-column-field";
import { draftNeedsMarker, markerChoices } from "@/features/accounts/csv-guess";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

interface CsvSignFieldsProps {
  text: string;
  headers: string[];
  value: ProfileDraft;
  onChange: (patch: ProfileDraft) => void;
}

// The column that marks a line as a debit or a credit, and the mark of a debit.
export function CsvSignFields({
  text,
  headers,
  value,
  onChange,
}: CsvSignFieldsProps) {
  const t = useT();
  const marker = value.debit_marker ?? "";
  const asked =
    (value.sign_column ?? "") !== "" || draftNeedsMarker(text, value);
  const found = markerChoices(text, value);
  const choices = (
    found.includes(marker) || marker === "" ? found : [marker, ...found]
  ).map((v) => ({ value: v, label: v }));

  return (
    <>
      <CsvColumnField
        label={t("importFile.signColumn")}
        field="sign_column"
        optional
        headers={headers}
        value={value}
        onChange={(patch) => {
          onChange({ ...patch, debit_marker: undefined });
        }}
      />

      {asked && (
        <Field required>
          <FieldLabel>{t("importFile.debitMarker")}</FieldLabel>
          <ChoiceSelect
            label={t("importFile.debitMarker")}
            choices={choices}
            value={marker === "" ? null : marker}
            multiple={false}
            onChange={(next) => {
              onChange({
                debit_marker:
                  typeof next === "string" && next !== "" ? next : undefined,
              });
            }}
          />
          <FieldDescription>{t("importFile.debitMarkerHint")}</FieldDescription>
        </Field>
      )}
    </>
  );
}
