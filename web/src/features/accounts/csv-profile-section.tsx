import { CsvAmountFields } from "@/features/accounts/csv-amount-fields";
import { CsvColumnField } from "@/features/accounts/csv-column-field";
import { CsvDateFields } from "@/features/accounts/csv-date-fields";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { CsvSuggestionAction } from "@/features/accounts/csv-suggestion-action";
import { CsvReadingFields } from "@/features/accounts/csv-reading-fields";
import { useT } from "@/i18n/i18n-provider";
import { FormSection } from "@/ui/form-section";

interface CsvProfileSectionProps {
  id: string;
  troubled: boolean;
  text: string;
  value: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  headers: string[];
}

// How the server reads this account's CSV files (A13): the columns are the file's own header
// names, or 1-based positions when the file has no header.
export function CsvProfileSection({
  id,
  troubled,
  text,
  value,
  onChange,
  headers,
}: CsvProfileSectionProps) {
  const t = useT();
  const set = (patch: ProfileDraft) => {
    onChange({ ...value, ...patch });
  };

  return (
    <FormSection legend={t("importFile.profile")}>
      <CsvSuggestionAction
        id={id}
        text={text}
        draft={value}
        troubled={troubled}
        onChange={onChange}
      />

      <CsvReadingFields value={value} onChange={set} />

      <CsvDateFields
        text={text}
        headers={headers}
        value={value}
        onChange={set}
      />

      <CsvColumnField
        label={t("importFile.descriptionColumn")}
        field="description_column"
        headers={headers}
        value={value}
        onChange={set}
      />
      <CsvColumnField
        label={t("importFile.idColumn")}
        field="id_column"
        optional
        headers={headers}
        value={value}
        onChange={set}
      />

      <CsvAmountFields
        text={text}
        headers={headers}
        value={value}
        onChange={set}
      />
    </FormSection>
  );
}
