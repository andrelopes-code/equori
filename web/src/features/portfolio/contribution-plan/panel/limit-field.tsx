import { NumberField } from "@slotted/react/number-field";

import type { LimitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import {
  isWhole,
  limitBounds,
  limitHolds,
  limitNumber,
  limitText,
} from "@/features/portfolio/contribution-plan/criteria/model/limit-value";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useSavedField } from "@/features/portfolio/contribution-plan/panel/use-saved-field";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface LimitFieldProps {
  criterion: LimitCriterion;
  // The stored limit, "" for none.
  limit: string;
  // The name of the field; by default the name of the criterion.
  label?: string;
  onLimit: (limit: string) => void;
}

// The limit of an automatic criterion, in the unit of its figure. A value out of range is marked and
// not sent; an empty one is, and the criterion then counts for nothing (CO2).
export function LimitField({
  criterion,
  limit,
  label,
  onLimit,
}: LimitFieldProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const field = useSavedField(limit, (next) => {
    if (next === "" || limitHolds(criterion, next)) onLimit(next);

    return true;
  });

  const bounds = limitBounds(criterion);
  const ends: Record<LimitCriterion["unit"], string | undefined> = {
    percent: "%",
    years: t("contributionPlan.criteria.years"),
    times: undefined,
    points: undefined,
  };

  return (
    <NumberField
      className={styles.limit}
      size="sm"
      stepper="none"
      locale={locale}
      value={limitNumber(criterion, field.value)}
      min={bounds.min}
      max={bounds.max}
      step={1}
      clamp="none"
      formatOn="commit"
      format={{
        maximumFractionDigits: isWhole(criterion) ? 0 : 2,
        useGrouping: false,
      }}
      end={ends[criterion.unit]}
      invalid={field.value !== "" && !limitHolds(criterion, field.value)}
      aria-label={
        label ??
        t("contributionPlan.criteria.limitOf", { name: t(criterion.label) })
      }
      onValueChange={(value) => {
        field.onChange(limitText(criterion, value));
      }}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
    />
  );
}
