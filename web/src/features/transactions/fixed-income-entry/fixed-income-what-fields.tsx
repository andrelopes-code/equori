import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { subtypeLabel } from "@/features/instruments";
import type { FixedIncomeDraft } from "@/features/transactions/fixed-income-entry/fixed-income-draft";
import type { FixedIncomeView } from "@/features/transactions/fixed-income-entry/use-fixed-income-entry";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormSection } from "@/ui/form-layout/form-section";

interface FixedIncomeWhatFieldsProps {
  draft: FixedIncomeDraft;
  view: FixedIncomeView;
  errors: Record<string, string>;
  onChange: (patch: Partial<FixedIncomeDraft>) => void;
}

const issuerList = "fixed-income-issuers";

// Which contract the money goes to: one the book holds, or a new one named by kind and issuer.
export function FixedIncomeWhatFields({
  draft,
  view,
  errors,
  onChange,
}: FixedIncomeWhatFieldsProps) {
  const t = useT();
  const contracts = [
    { value: "", label: t("fixedIncome.newContract") },
    ...view.contracts.map((c) => ({ value: c.code, label: c.name })),
  ];
  const subtypes = view.subtypes.map((s) => ({
    value: s,
    label: subtypeLabel(t, s),
  }));

  return (
    <FormSection legend={t("fixedIncome.what")}>
      {view.contracts.length > 0 && (
        <Field>
          <FieldLabel>{t("fixedIncome.existing")}</FieldLabel>
          <ChoiceSelect
            label={t("fixedIncome.existing")}
            choices={contracts}
            value={draft.instrument ?? ""}
            multiple={false}
            onChange={(next) => {
              if (typeof next === "string")
                onChange({ instrument: next === "" ? null : next });
            }}
          />
        </Field>
      )}

      {draft.instrument === null && (
        <>
          <Field required>
            <FieldLabel>{t("fixedIncome.subtype")}</FieldLabel>
            <ChoiceSelect
              label={t("fixedIncome.subtype")}
              choices={subtypes}
              value={draft.subtype}
              multiple={false}
              onChange={(next) => {
                if (typeof next === "string") onChange({ subtype: next });
              }}
            />
          </Field>

          <Field required invalid={errors["contract.issuer"] !== undefined}>
            <FieldLabel>{t("fixedIncome.issuer")}</FieldLabel>
            <TextField
              name="issuer"
              list={issuerList}
              value={draft.issuer}
              onChange={(event) => {
                onChange({ issuer: event.target.value });
              }}
            />
            <datalist id={issuerList}>
              {view.issuers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {errors["contract.issuer"] !== undefined && (
              <FieldError>{errors["contract.issuer"]}</FieldError>
            )}
          </Field>
        </>
      )}
    </FormSection>
  );
}
