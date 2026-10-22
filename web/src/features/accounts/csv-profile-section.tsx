import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Grid } from "@slotted/react/grid";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";

import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

const none = "";

// How the server reads this account's CSV files (A13): the columns are the file's own header
// names, or 1-based positions when the file has no header.
export function CsvProfileSection({
  value,
  onChange,
  headers,
}: {
  value: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  headers: string[];
}) {
  const t = useT();
  const set = (patch: ProfileDraft) => {
    onChange({ ...value, ...patch });
  };
  const columns = headers.map((h) => ({ value: h, label: h }));
  const split =
    (value.amount_column ?? "") === "" && (value.debit_column ?? "") !== "";
  const column = (
    label: string,
    field:
      | "date_column"
      | "description_column"
      | "amount_column"
      | "debit_column"
      | "credit_column"
      | "id_column",
    optional = false,
  ) => (
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
          set({
            [field]:
              typeof next === "string" && next !== none ? next : undefined,
          });
        }}
      />
    </Field>
  );
  return (
    <FieldGroup>
      <FieldGroupLegend>{t("importFile.profile")}</FieldGroupLegend>
      <FieldGroupContent>
        <Stack gap={4}>
          <Grid columns={2} gap={4} minItemWidth="sm">
            <Field>
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
                    set({ delimiter: next });
                  }
                }}
              />
            </Field>
            <Field>
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
                  if (typeof next === "string")
                    set({ header_rows: Number(next) });
                }}
              />
            </Field>
            {column(t("importFile.dateColumn"), "date_column")}
            <Field required>
              <FieldLabel>{t("importFile.dateLayout")}</FieldLabel>
              <ChoiceSelect
                label={t("importFile.dateLayout")}
                choices={["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"].map(
                  (l) => ({ value: l, label: l }),
                )}
                value={value.date_layout ?? null}
                multiple={false}
                onChange={(next) => {
                  if (
                    next === "DD/MM/YYYY" ||
                    next === "YYYY-MM-DD" ||
                    next === "MM/DD/YYYY"
                  ) {
                    set({ date_layout: next });
                  }
                }}
              />
            </Field>
            {column(t("importFile.descriptionColumn"), "description_column")}
            {column(t("importFile.idColumn"), "id_column", true)}
          </Grid>
          <Field>
            <FieldLabel>{t("importFile.amountMode")}</FieldLabel>
            <SegmentedControl
              aria-label={t("importFile.amountMode")}
              value={split ? "split" : "single"}
              onValueChange={(mode) => {
                if (mode === "single") {
                  set({ debit_column: undefined, credit_column: undefined });
                } else if (mode === "split") {
                  set({
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
          </Field>
          <Grid columns={2} gap={4} minItemWidth="sm">
            {split ? (
              <>
                {column(t("importFile.debitColumn"), "debit_column")}
                {column(t("importFile.creditColumn"), "credit_column")}
              </>
            ) : (
              column(t("importFile.amountColumn"), "amount_column")
            )}
            <Field required>
              <FieldLabel>{t("importFile.decimal")}</FieldLabel>
              <SegmentedControl
                aria-label={t("importFile.decimal")}
                value={value.decimal_separator ?? ","}
                onValueChange={(next) => {
                  if (next === "," || next === ".")
                    set({ decimal_separator: next });
                }}
              >
                <Segment value=",">{t("importFile.decimal.comma")}</Segment>
                <Segment value=".">{t("importFile.decimal.dot")}</Segment>
              </SegmentedControl>
            </Field>
          </Grid>
          <Field>
            <Switch
              checked={value.amount_sign === "inverted"}
              onCheckedChange={(on) => {
                set({ amount_sign: on ? "inverted" : "as_is" });
              }}
            >
              {t("importFile.inverted")}
            </Switch>
            <FieldDescription>{t("importFile.invertedHint")}</FieldDescription>
          </Field>
        </Stack>
      </FieldGroupContent>
    </FieldGroup>
  );
}
