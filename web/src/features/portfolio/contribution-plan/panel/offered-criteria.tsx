import { Text } from "@slotted/react/typography";

import type { LimitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { CriterionPick } from "@/features/portfolio/contribution-plan/panel/criterion-pick";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useT } from "@/i18n/i18n-provider";

interface OfferedCriteriaProps {
  offered: readonly LimitCriterion[];
  onAdd: (fact: string) => void;
}

// The automatic criteria that apply to the group, offered beside the field of a new question.
export function OfferedCriteria({ offered, onAdd }: OfferedCriteriaProps) {
  const t = useT();

  if (offered.length === 0) return null;

  return (
    <>
      <Text size="sm" weight="semibold" tone="muted">
        {t("contributionPlan.panel.orAutomatic")}
      </Text>

      <ul className={styles.picks}>
        {offered.map((criterion) => (
          <CriterionPick
            key={criterion.key}
            label={t(criterion.label)}
            meaning={t(criterion.meaning)}
            onAdd={() => {
              onAdd(criterion.key);
            }}
          />
        ))}
      </ul>
    </>
  );
}
