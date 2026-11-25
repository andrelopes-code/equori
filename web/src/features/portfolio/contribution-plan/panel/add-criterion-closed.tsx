import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import { CriteriaHelp } from "@/features/portfolio/contribution-plan/criteria/add/criteria-help";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useT } from "@/i18n/i18n-provider";

interface AddCriterionClosedProps {
  // Whether the group holds the most criteria it may.
  full: boolean;
  onOpen: () => void;
}

// The way to a new criterion before it opens, beside what the studies say of the criteria.
export function AddCriterionClosed({ full, onOpen }: AddCriterionClosedProps) {
  const t = useT();

  return (
    <div className={styles.addRow}>
      <Button
        size="sm"
        variant="ghost"
        tone="secondary"
        disabled={full}
        start={<Glyph name="plus" />}
        onClick={onOpen}
      >
        {t("contributionPlan.criteria.add")}
      </Button>

      <CriteriaHelp />

      {full && (
        <Text size="xs" tone="muted">
          {t("contributionPlan.criteria.full")}
        </Text>
      )}
    </div>
  );
}
