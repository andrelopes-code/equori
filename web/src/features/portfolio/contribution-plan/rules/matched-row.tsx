import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import listStyles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import styles from "@/features/portfolio/contribution-plan/rules/rules.module.css";
import { useScale } from "@/features/setup";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Matched = components["schemas"]["ContributionMatched"];

interface MatchedRowProps {
  matched: Matched;
}

// A security a rule of the group meets: its name and its value, with nothing to edit.
export function MatchedRow({ matched }: MatchedRowProps) {
  const fmt = useMoneyFormat();
  const scale = useScale();

  return (
    <div role="listitem" className={listStyles.row}>
      <Text size="md" className={listStyles.member}>
        {matched.instrument}
      </Text>

      <Text size="md" className={styles.matchedValue}>
        {fmt.money(matched.value, scale?.(matched.value.currency) ?? 0)}
      </Text>
    </div>
  );
}
