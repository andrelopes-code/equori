import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/budget-plan/budget-plan.module.css";
import { useT } from "@/i18n/i18n-provider";

interface PlanOverMarkProps {
  // The sum of the bar's segments.
  scale: number;
  reference: number;
}

// The excess of the plan, marked above the allocation bar from the point of the reference to
// the bar's end (budget plan spec 5.1). The amount is the panel's figure, so the mark names
// itself only.
export function PlanOverMark({ scale, reference }: PlanOverMarkProps) {
  const t = useT();

  if (reference <= 0 || scale <= reference) return null;

  const start = `${String((reference * 100) / scale)}%`;

  return (
    <div className={styles.overMark}>
      <Text size="xs" tone="danger" weight="medium">
        {t("plan.overSegment")}
      </Text>

      <span
        className={styles.overLine}
        style={{ insetInlineStart: start }}
        aria-hidden="true"
      />
    </div>
  );
}
