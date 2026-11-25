import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type {
  PlanFields,
  WithdrawalMode,
} from "@/features/portfolio/projection/model/plan-fields";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { UnitField } from "@/features/portfolio/projection/plan-section/unit-field";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money/money-input";

interface WithdrawalFieldsProps {
  fields: PlanFields;
  currency: string;
  onChange: (patch: Partial<PlanFields>) => void;
}

// PX2: the withdrawal mode and its figure, an income in the plan currency or a rate a year.
export function WithdrawalFields({
  fields,
  currency,
  onChange,
}: WithdrawalFieldsProps) {
  const t = useT();
  const scale = useScale();

  function handleMode(mode: string) {
    if (mode === "income" || mode === "rate")
      onChange({ mode: mode satisfies WithdrawalMode });
  }

  return (
    <>
      <Field necessity="none" className={styles.planMode}>
        <FieldLabel>{t("portfolio.projection.plan.withdrawal")}</FieldLabel>

        <SegmentedControl
          aria-label={t("portfolio.projection.plan.withdrawal")}
          value={fields.mode}
          onValueChange={handleMode}
        >
          <Segment value="income">
            {t("portfolio.projection.plan.modeIncome")}
          </Segment>
          <Segment value="rate">
            {t("portfolio.projection.plan.modeRate")}
          </Segment>
        </SegmentedControl>
      </Field>

      {fields.mode === "income" && (
        <Field necessity="none" width="medium" className={styles.planField}>
          <FieldLabel>{t("portfolio.projection.plan.income")}</FieldLabel>

          <MoneyInput
            size="field"
            value={fields.income}
            onChange={(income) => {
              onChange({ income });
            }}
            currency={currency}
            scale={scale?.(currency) ?? 0}
            sign="neutral"
          />

          <FieldDescription>
            {t("portfolio.projection.plan.incomeHint")}
          </FieldDescription>
        </Field>
      )}

      {fields.mode === "rate" && (
        <UnitField
          label={t("portfolio.projection.plan.rate")}
          unit={t("portfolio.projection.plan.perYear")}
          inputMode="decimal"
          value={fields.rate}
          hint={t("portfolio.projection.plan.rateHint")}
          onChange={(rate) => {
            onChange({ rate });
          }}
        />
      )}
    </>
  );
}
