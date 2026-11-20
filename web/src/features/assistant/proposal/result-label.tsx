import { Text } from "@slotted/react/typography";

import styles from "@/features/assistant/proposal/results.module.css";
import type { ProposalCardState } from "@/features/assistant/proposal/proposal-card-state";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// A write an executed undo reversed reads "undone" (answer views design V19).
export type ResultStatus = ProposalCardState["status"] | "undone";

const tones: Partial<Record<ResultStatus, string | undefined>> = {
  executed: styles.success,
  failed: styles.danger,
};

interface ResultLabelProps {
  status: ResultStatus;
}

// Families read: typography. The state of a decided proposal as a word after a 6 px dot in the
// state's tone; the dot is the only mark, a failure carries no icon.
export function ResultLabel({ status }: ResultLabelProps) {
  const t = useT();

  return (
    <span className={cx(styles.state, tones[status] ?? styles.muted)}>
      <span className={styles.dot} />
      <Text size="sm" weight="medium">
        {t(`assistant.proposal.status.${status}`)}
      </Text>
    </span>
  );
}
