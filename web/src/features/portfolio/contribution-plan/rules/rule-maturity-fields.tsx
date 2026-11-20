import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { maturityYears } from "@/features/portfolio/contribution-plan/rules/maturity-years";
import type { yearProblem } from "@/features/portfolio/contribution-plan/rules/rule-form";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormRow } from "@/ui/form-layout/form-row";
import { FormSection } from "@/ui/form-layout/form-section";

interface RuleMaturityFieldsProps {
  from: number | null;
  to: number | null;
  problem: ReturnType<typeof yearProblem>;
  onFrom: (from: number | null) => void;
  onTo: (to: number | null) => void;
}

// The two optional years of the maturity, with the error of the pair under the second.
export function RuleMaturityFields({
  from,
  to,
  problem,
  onFrom,
  onTo,
}: RuleMaturityFieldsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();

  const year = numberFormatter(tag, { useGrouping: false });
  const choices = [
    { value: "", label: t("contributionPlan.rule.dialog.anyYear") },
    ...maturityYears(today, [from, to]).map((y) => ({
      value: String(y),
      label: year.format(y),
    })),
  ];
  const toYear = (value: string | string[] | null) =>
    typeof value === "string" && value !== "" ? Number(value) : null;

  return (
    <FormSection
      legend={t("contributionPlan.rule.dialog.maturity")}
      description={t("contributionPlan.rule.dialog.maturityHint")}
    >
      <FormRow>
        <Field invalid={problem !== undefined}>
          <FieldLabel>{t("contributionPlan.rule.dialog.from")}</FieldLabel>
          <ChoiceSelect
            label={t("contributionPlan.rule.dialog.from")}
            choices={choices}
            value={from === null ? "" : String(from)}
            multiple={false}
            onChange={(value) => {
              onFrom(toYear(value));
            }}
          />
        </Field>

        <Field invalid={problem !== undefined}>
          <FieldLabel>{t("contributionPlan.rule.dialog.to")}</FieldLabel>
          <ChoiceSelect
            label={t("contributionPlan.rule.dialog.to")}
            choices={choices}
            value={to === null ? "" : String(to)}
            multiple={false}
            onChange={(value) => {
              onTo(toYear(value));
            }}
          />
          {problem !== undefined && (
            <FieldError>
              {t(`contributionPlan.rule.dialog.${problem}`)}
            </FieldError>
          )}
        </Field>
      </FormRow>
    </FormSection>
  );
}
