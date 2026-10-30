import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";

interface ProposalChangeProps {
  before: string | undefined;
  after: string | undefined;
}

// One changed value of a proposal: the new value, then the value it replaces under it, struck and
// muted. A value the proposal only removes is struck alone.
export function ProposalChange({ before, after }: ProposalChangeProps) {
  const t = useT();

  if (after === undefined) {
    return (
      <Text size="sm" tone="muted" className={styles.removed}>
        {before}
      </Text>
    );
  }

  return (
    <span className={styles.change}>
      <Text size="sm" weight="medium">
        {before !== undefined && (
          <VisuallyHidden>{t("assistant.change.after")}</VisuallyHidden>
        )}
        {after}
      </Text>
      {before !== undefined && (
        <Text size="xs" tone="muted" className={styles.removed}>
          <VisuallyHidden>{t("assistant.change.before")}</VisuallyHidden>
          {before}
        </Text>
      )}
    </span>
  );
}
