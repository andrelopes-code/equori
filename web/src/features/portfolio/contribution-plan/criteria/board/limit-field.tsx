import { NumberField } from "@slotted/react/number-field";

import styles from "@/features/portfolio/contribution-plan/criteria/board/board.module.css";
import type { LimitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import {
  limitBounds,
  limitNumber,
  limitText,
} from "@/features/portfolio/contribution-plan/criteria/model/limit-value";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface LimitFieldProps {
  criterion: LimitCriterion;
  // The stored limit, "" for none.
  limit: string;
  invalid: boolean;
  onChange: (limit: string) => void;
}

// The limit of an automatic criterion, in the unit of its figure.
export function LimitField({
  criterion,
  limit,
  invalid,
  onChange,
}: LimitFieldProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const bounds = limitBounds(criterion);
  const years = criterion.unit === "years";
  const ends: Record<LimitCriterion["unit"], string | undefined> = {
    percent: "%",
    years: t("contributionPlan.criteria.years"),
    times: undefined,
  };

  return (
    <NumberField
      className={styles.limit}
      size="sm"
      stepper="none"
      locale={locale}
      value={limitNumber(criterion, limit)}
      min={bounds.min}
      max={bounds.max}
      step={1}
      clamp="none"
      formatOn="commit"
      format={{
        maximumFractionDigits: years ? 0 : 2,
        useGrouping: false,
      }}
      end={ends[criterion.unit]}
      invalid={invalid}
      aria-label={t("contributionPlan.criteria.limitOf", {
        name: t(criterion.label),
      })}
      onValueChange={(value) => {
        onChange(limitText(criterion, value));
      }}
    />
  );
}
