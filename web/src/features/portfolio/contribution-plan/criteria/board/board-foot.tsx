import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/criteria/board/board.module.css";
import { ClearCriteria } from "@/features/portfolio/contribution-plan/criteria/board/clear-criteria";
import { useT } from "@/i18n/i18n-provider";

interface BoardFootProps {
  // Whether no asset has a point.
  noYes: boolean;
  // The names of the assets without statements.
  unanswered: string[];
  // The name of the group.
  name: string;
  onClear: () => void;
}

// Under the board: what the reader should know of its answers, and the way back to typed ideals.
export function BoardFoot({
  noYes,
  unanswered,
  name,
  onClear,
}: BoardFootProps) {
  const t = useT();

  const text = [
    noYes ? t("contributionPlan.criteria.noYes") : "",
    unanswered.length > 0
      ? t("contributionPlan.criteria.noReport", {
          names: unanswered.join(", "),
        })
      : "",
  ]
    .filter((part) => part !== "")
    .join(" ");

  return (
    <div className={styles.foot}>
      <Text size="sm" tone="muted" truncate title={text}>
        {text}
      </Text>

      <ClearCriteria name={name} onClear={onClear} />
    </div>
  );
}
