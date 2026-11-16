import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { TextField } from "@slotted/react/text-field";

import { indexName } from "@/features/calculators";
import type { FixedIncomeDraft } from "@/features/transactions/fixed-income-entry/fixed-income-draft";
import type { FixedIncomeView } from "@/features/transactions/fixed-income-entry/use-fixed-income-entry";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormSection } from "@/ui/form-layout/form-section";

interface FixedIncomeReturnFieldsProps {
  draft: FixedIncomeDraft;
  view: FixedIncomeView;
  errors: Record<string, string>;
  onChange: (patch: Partial<FixedIncomeDraft>) => void;
}

const rateLabels = {
  rate: "fixedIncome.percentOfIndex",
  inflation: "fixedIncome.addedRate",
  fixed: "fixedIncome.fixedRate",
} as const;

// The return: a percent of a daily index, a monthly index plus a rate, or a fixed rate.
export function FixedIncomeReturnFields({
  draft,
  view,
  errors,
  onChange,
}: FixedIncomeReturnFieldsProps) {
  const t = useT();
  const rateLabel = t(rateLabels[draft.returnKind]);
  const choices = view.indexes.map((i) => ({
    value: i.id,
    label: indexName(i.id),
  }));

  return (
    <FormSection legend={t("fixedIncome.return")}>
      <Inline>
        <SegmentedControl
          aria-label={t("fixedIncome.return")}
          value={draft.returnKind}
          onValueChange={(next) => {
            if (next === "rate" || next === "inflation" || next === "fixed")
              onChange({ returnKind: next, indexId: "" });
          }}
        >
          <Segment value="rate">{t("fixedIncome.return.rate")}</Segment>
          <Segment value="inflation">
            {t("fixedIncome.return.inflation")}
          </Segment>
          <Segment value="fixed">{t("fixedIncome.return.fixed")}</Segment>
        </SegmentedControl>
      </Inline>

      {draft.returnKind !== "fixed" && (
        <Field>
          <FieldLabel>{t("terms.index")}</FieldLabel>
          <ChoiceSelect
            label={t("terms.index")}
            choices={choices}
            value={view.indexId}
            multiple={false}
            onChange={(next) => {
              if (typeof next === "string") onChange({ indexId: next });
            }}
          />
        </Field>
      )}

      <Field required invalid={errors.rate !== undefined}>
        <FieldLabel>{rateLabel}</FieldLabel>
        <TextField
          name="rate"
          inputMode="decimal"
          value={draft.percent}
          onChange={(event) => {
            onChange({ percent: event.target.value });
          }}
        />
        {errors.rate !== undefined && <FieldError>{errors.rate}</FieldError>}
      </Field>
    </FormSection>
  );
}
