import { indexName } from "@/features/calculators";
import type {
  FieldRanges,
  PlanFields,
} from "@/features/portfolio/projection/model/plan-fields";
import { PlanGroup } from "@/features/portfolio/projection/plan-section/plan-group";
import { PlanRow } from "@/features/portfolio/projection/plan-section/plan-row";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { ReferencesScale } from "@/features/portfolio/projection/plan-section/references-scale";
import { usePlanReferences } from "@/features/portfolio/projection/plan-section/use-plan-references";
import { formatBasisPoints, formatYear, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface PremiseGroupsProps {
  fields: PlanFields;
  ranges: FieldRanges;
  range: (limits: [number, number] | undefined) => string | undefined;
  // The realized real return of the portfolio a year, a fraction; null under 12 months of history.
  annualReal: number | null;
  currency: string;
  onChange: (patch: Partial<PlanFields>) => void;
}

// PX17: the premises under the line: the real return and its cases, the withdrawals and costs,
// and the references they are read against.
export function PremiseGroups({
  fields,
  ranges,
  range,
  annualReal,
  currency,
  onChange,
}: PremiseGroupsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const references = usePlanReferences(currency);

  const perYear = t("portfolio.projection.plan.perYear");
  const realNote =
    annualReal === null
      ? t("portfolio.projection.plan.shortHistory")
      : t("portfolio.projection.plan.portfolioReturn", {
          rate: numberFormatter(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(annualReal * 100),
        });
  const expected = references.inflation;
  const inflationNote =
    expected === null
      ? t("portfolio.projection.plan.inflationHint")
      : t("portfolio.projection.plan.inflationExpected", {
          index: indexName(expected.index),
          year: formatYear(`${String(expected.year)}-01-01`, locale),
          rate: formatBasisPoints(Math.round(expected.rate * 10000), locale),
        });

  return (
    <div className={styles.planGroups}>
      <PlanGroup
        legend={t("portfolio.projection.plan.returns")}
        description={t("portfolio.projection.plan.returnsDescription")}
      >
        <PlanRow
          label={t("portfolio.projection.plan.realReturn")}
          help={t("portfolio.projection.plan.realReturnHelp")}
          unit={perYear}
          value={fields.realReturn}
          note={realNote}
          error={range(ranges.realReturn)}
          onChange={(realReturn) => {
            onChange({ realReturn });
          }}
        />

        <PlanRow
          label={t("portfolio.projection.plan.cautious")}
          help={t("portfolio.projection.plan.cautiousHelp")}
          optional
          unit={perYear}
          value={fields.cautious}
          note={t("portfolio.projection.plan.cautiousHint")}
          error={range(ranges.cautious)}
          onChange={(cautious) => {
            onChange({ cautious });
          }}
        />

        <PlanRow
          label={t("portfolio.projection.plan.favorable")}
          help={t("portfolio.projection.plan.favorableHelp")}
          optional
          unit={perYear}
          value={fields.favorable}
          note={t("portfolio.projection.plan.favorableHint")}
          error={range(ranges.favorable)}
          onChange={(favorable) => {
            onChange({ favorable });
          }}
        />
      </PlanGroup>

      <PlanGroup
        legend={t("portfolio.projection.plan.costs")}
        description={t("portfolio.projection.plan.costsDescription")}
      >
        <PlanRow
          label={t("portfolio.projection.plan.withdrawalReturn")}
          help={t("portfolio.projection.plan.withdrawalReturnHelp")}
          optional
          unit={perYear}
          value={fields.withdrawalReturn}
          note={t("portfolio.projection.plan.withdrawalReturnHint")}
          error={range(ranges.withdrawalReturn)}
          onChange={(withdrawalReturn) => {
            onChange({ withdrawalReturn });
          }}
        />

        <PlanRow
          label={t("portfolio.projection.plan.inflation")}
          help={t("portfolio.projection.plan.inflationHelp")}
          unit={perYear}
          value={fields.inflation}
          note={inflationNote}
          error={range(ranges.inflation)}
          onChange={(inflation) => {
            onChange({ inflation });
          }}
        />

        <PlanRow
          label={t("portfolio.projection.plan.gainTax")}
          help={t("portfolio.projection.plan.gainTaxHelp")}
          optional
          unit={t("portfolio.projection.plan.percent")}
          value={fields.gainTax}
          note={t("portfolio.projection.plan.gainTaxHint")}
          error={range(ranges.gainTax)}
          onChange={(gainTax) => {
            onChange({ gainTax });
          }}
        />
      </PlanGroup>

      <ReferencesScale
        fields={fields}
        curve={references.real}
        annualReal={annualReal}
      />
    </div>
  );
}
