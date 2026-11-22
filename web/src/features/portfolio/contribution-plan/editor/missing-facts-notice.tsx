import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { useT } from "@/i18n/i18n-provider";

interface MissingFactsNoticeProps {
  // The names of the assets the filings answer nothing for.
  names: string[];
}

// One line that names the assets left to the investor's answers: without a yes they receive
// nothing (CQ3), and the filings will never give them one.
export function MissingFactsNotice({ names }: MissingFactsNoticeProps) {
  const t = useT();

  if (names.length === 0) return null;

  const text = t("contributionPlan.facts.missing", {
    names: names.join(", "),
  });

  return (
    <Text size="sm" tone="muted" truncate title={text} className={styles.noYes}>
      {text}
    </Text>
  );
}
