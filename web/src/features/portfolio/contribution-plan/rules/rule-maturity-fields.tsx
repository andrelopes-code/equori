import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { NumberField } from "@slotted/react/number-field";

import type { yearProblem } from "@/features/portfolio/contribution-plan/rules/rule-form";
import { useT } from "@/i18n/i18n-provider";
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

  return (
    <FormSection legend={t("contributionPlan.rule.dialog.maturity")}>
      <FormRow>
        <Field invalid={problem !== undefined}>
          <FieldLabel>{t("contributionPlan.rule.dialog.from")}</FieldLabel>
          <NumberField
            value={from}
            format={{ useGrouping: false }}
            onValueChange={onFrom}
          />
        </Field>

        <Field invalid={problem !== undefined}>
          <FieldLabel>{t("contributionPlan.rule.dialog.to")}</FieldLabel>
          <NumberField
            value={to}
            format={{ useGrouping: false }}
            onValueChange={onTo}
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
