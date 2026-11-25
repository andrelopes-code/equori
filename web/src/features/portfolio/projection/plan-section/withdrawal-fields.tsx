import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type {
  PlanFields,
  WithdrawalMode,
} from "@/features/portfolio/projection/model/plan-fields";
import { LifeField } from "@/features/portfolio/projection/plan-section/life-field";
import { UnitInput } from "@/features/portfolio/projection/plan-section/unit-input";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money/money-input";

interface WithdrawalFieldsProps {
  fields: PlanFields;
  currency: string;
  // The range the typed rate left, written under its field.
  rateError: string | undefined;
  // PX2: with other incomes on the list the income is the total.
  otherIncomes: boolean;
  onChange: (patch: Partial<PlanFields>) => void;
}

// PX2, PX17: the withdrawal mode and its figure, an income in the plan currency or a rate a year.
export function WithdrawalFields({
  fields,
  currency,
  rateError,
  otherIncomes,
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
      <LifeField
        label={t("portfolio.projection.plan.withdrawal")}
        help={t("portfolio.projection.plan.modeHelp")}
      >
        <SegmentedControl
          fullWidth
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
      </LifeField>

      {fields.mode === "income" && (
        <LifeField
          label={t("portfolio.projection.plan.income")}
          note={
            otherIncomes
              ? t("portfolio.projection.plan.incomeTotal")
              : t("portfolio.projection.plan.incomeHint")
          }
        >
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
        </LifeField>
      )}

      {fields.mode === "rate" && (
        <LifeField
          label={t("portfolio.projection.plan.rate")}
          note={t("portfolio.projection.plan.rateHint")}
          error={rateError}
        >
          <UnitInput
            unit={t("portfolio.projection.plan.perYear")}
            inputMode="decimal"
            value={fields.rate}
            onChange={(rate) => {
              onChange({ rate });
            }}
          />
        </LifeField>
      )}
    </>
  );
}
