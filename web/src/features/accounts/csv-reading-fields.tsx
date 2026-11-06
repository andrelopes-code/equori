import { Field, FieldLabel } from "@slotted/react/field";

import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

interface CsvReadingFieldsProps {
  value: ProfileDraft;
  onChange: (patch: ProfileDraft) => void;
}

export function CsvReadingFields({ value, onChange }: CsvReadingFieldsProps) {
  const t = useT();

  return (
    <>
      <Field width="medium" required>
        <FieldLabel>{t("importFile.delimiter")}</FieldLabel>
        <ChoiceSelect
          label={t("importFile.delimiter")}
          choices={[
            {
              value: "semicolon",
              label: t("importFile.delimiter.semicolon"),
            },
            { value: "comma", label: t("importFile.delimiter.comma") },
            { value: "tab", label: t("importFile.delimiter.tab") },
            { value: "pipe", label: t("importFile.delimiter.pipe") },
          ]}
          value={value.delimiter ?? "comma"}
          multiple={false}
          onChange={(next) => {
            if (
              next === "semicolon" ||
              next === "comma" ||
              next === "tab" ||
              next === "pipe"
            ) {
              onChange({ delimiter: next });
            }
          }}
        />
      </Field>

      <Field width="short" required>
        <FieldLabel>{t("importFile.headerRows")}</FieldLabel>
        <ChoiceSelect
          label={t("importFile.headerRows")}
          choices={[0, 1, 2, 3].map((n) => ({
            value: String(n),
            label: String(n),
          }))}
          value={String(value.header_rows ?? 1)}
          multiple={false}
          onChange={(next) => {
            if (typeof next === "string") {
              onChange({ header_rows: Number(next) });
            }
          }}
        />
      </Field>
    </>
  );
}
