import type {
  FieldRanges,
  PlanFields,
} from "@/features/portfolio/projection/model/plan-fields";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { UnitField } from "@/features/portfolio/projection/plan-section/unit-field";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface PremiseFieldsProps {
  fields: PlanFields;
  ranges: FieldRanges;
  range: (limits: [number, number] | undefined) => string | undefined;
  // The realized real return of the portfolio a year, a fraction; null under 12 months of history.
  annualReal: number | null;
  onChange: (patch: Partial<PlanFields>) => void;
}

// PX17: the premises of the plan, the second row of the plan section.
export function PremiseFields({
  fields,
  ranges,
  range,
  annualReal,
  onChange,
}: PremiseFieldsProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const portfolioReturn =
    annualReal === null
      ? undefined
      : t("portfolio.projection.plan.portfolioReturn", {
          rate: numberFormatter(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(annualReal * 100),
        });

  return (
    <div className={styles.planStrip}>
      <UnitField
        label={t("portfolio.projection.plan.realReturn")}
        unit={t("portfolio.projection.plan.perYear")}
        inputMode="decimal"
        value={fields.realReturn}
        hint={portfolioReturn}
        error={range(ranges.realReturn)}
        onChange={(realReturn) => {
          onChange({ realReturn });
        }}
      />

      <UnitField
        label={t("portfolio.projection.plan.cautious")}
        unit={t("portfolio.projection.plan.perYear")}
        inputMode="decimal"
        value={fields.cautious}
        hint={t("portfolio.projection.plan.optional")}
        error={range(ranges.cautious)}
        onChange={(cautious) => {
          onChange({ cautious });
        }}
      />

      <UnitField
        label={t("portfolio.projection.plan.favorable")}
        unit={t("portfolio.projection.plan.perYear")}
        inputMode="decimal"
        value={fields.favorable}
        hint={t("portfolio.projection.plan.optional")}
        error={range(ranges.favorable)}
        onChange={(favorable) => {
          onChange({ favorable });
        }}
      />

      <UnitField
        label={t("portfolio.projection.plan.withdrawalReturn")}
        unit={t("portfolio.projection.plan.perYear")}
        inputMode="decimal"
        value={fields.withdrawalReturn}
        hint={t("portfolio.projection.plan.withdrawalReturnHint")}
        error={range(ranges.withdrawalReturn)}
        onChange={(withdrawalReturn) => {
          onChange({ withdrawalReturn });
        }}
      />

      <UnitField
        label={t("portfolio.projection.plan.inflation")}
        unit={t("portfolio.projection.plan.perYear")}
        inputMode="decimal"
        value={fields.inflation}
        error={range(ranges.inflation)}
        onChange={(inflation) => {
          onChange({ inflation });
        }}
      />

      <UnitField
        label={t("portfolio.projection.plan.gainTax")}
        unit={t("portfolio.projection.plan.percent")}
        inputMode="decimal"
        value={fields.gainTax}
        hint={t("portfolio.projection.plan.optional")}
        error={range(ranges.gainTax)}
        onChange={(gainTax) => {
          onChange({ gainTax });
        }}
      />
    </div>
  );
}
