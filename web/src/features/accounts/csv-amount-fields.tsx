import { Checkbox } from "@slotted/react/checkbox";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import { CsvColumnField } from "@/features/accounts/csv-column-field";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { useT } from "@/i18n/i18n-provider";
import { FormRow } from "@/ui/form-row";

interface CsvAmountFieldsProps {
  headers: string[];
  value: ProfileDraft;
  onChange: (patch: ProfileDraft) => void;
}

export function CsvAmountFields({
  headers,
  value,
  onChange,
}: CsvAmountFieldsProps) {
  const t = useT();
  const split =
    (value.amount_column ?? "") === "" && (value.debit_column ?? "") !== "";

  return (
    <>
      <FieldGroup required>
        <FieldGroupLegend>{t("importFile.amountMode")}</FieldGroupLegend>
        <FieldGroupContent>
          <Inline>
            <SegmentedControl
              aria-label={t("importFile.amountMode")}
              value={split ? "split" : "single"}
              onValueChange={(mode) => {
                if (mode === "single") {
                  onChange({
                    debit_column: undefined,
                    credit_column: undefined,
                  });
                } else if (mode === "split") {
                  onChange({
                    amount_column: undefined,
                    debit_column: headers[0] ?? "1",
                    credit_column: headers[1] ?? "2",
                  });
                }
              }}
            >
              <Segment value="single">{t("importFile.amountSingle")}</Segment>
              <Segment value="split">{t("importFile.amountSplit")}</Segment>
            </SegmentedControl>
          </Inline>
        </FieldGroupContent>
      </FieldGroup>

      {split && (
        <FormRow>
          <CsvColumnField
            label={t("importFile.debitColumn")}
            field="debit_column"
            headers={headers}
            value={value}
            onChange={onChange}
          />
          <CsvColumnField
            label={t("importFile.creditColumn")}
            field="credit_column"
            headers={headers}
            value={value}
            onChange={onChange}
          />
        </FormRow>
      )}
      {!split && (
        <CsvColumnField
          label={t("importFile.amountColumn")}
          field="amount_column"
          headers={headers}
          value={value}
          onChange={onChange}
        />
      )}

      <FieldGroup required>
        <FieldGroupLegend>{t("importFile.decimal")}</FieldGroupLegend>
        <FieldGroupContent>
          <Inline>
            <SegmentedControl
              aria-label={t("importFile.decimal")}
              value={value.decimal_separator ?? ","}
              onValueChange={(next) => {
                if (next === "," || next === ".") {
                  onChange({ decimal_separator: next });
                }
              }}
            >
              <Segment value=",">{t("importFile.decimal.comma")}</Segment>
              <Segment value=".">{t("importFile.decimal.dot")}</Segment>
            </SegmentedControl>
          </Inline>
        </FieldGroupContent>
      </FieldGroup>

      <Checkbox
        checked={value.amount_sign === "inverted"}
        onCheckedChange={(on) => {
          onChange({ amount_sign: on ? "inverted" : "as_is" });
        }}
        description={t("importFile.invertedHint")}
      >
        {t("importFile.inverted")}
      </Checkbox>
    </>
  );
}
