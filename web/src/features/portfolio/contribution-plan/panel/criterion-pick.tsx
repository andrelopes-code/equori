import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useT } from "@/i18n/i18n-provider";

interface CriterionPickProps {
  label: string;
  meaning: string;
  onAdd: () => void;
}

// An automatic criterion offered in one line.
export function CriterionPick({ label, meaning, onAdd }: CriterionPickProps) {
  const t = useT();

  return (
    <li className={styles.pick}>
      <Text size="sm" weight="medium">
        {label}
      </Text>

      <Text size="xs" tone="muted" className={styles.pickMeaning}>
        {meaning}
      </Text>

      <Button
        size="sm"
        variant="outline"
        tone="secondary"
        aria-label={t("contributionPlan.criteria.addNamed", { name: label })}
        onClick={onAdd}
      >
        {t("contributionPlan.criteria.addOne")}
      </Button>
    </li>
  );
}
