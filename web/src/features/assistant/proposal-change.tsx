import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";

// One changed value of a proposal: the value it replaces, struck and muted, then the new one.
export function ProposalChange({
  before,
  after,
}: {
  before: string | undefined;
  after: string | undefined;
}) {
  const t = useT();
  if (before === undefined || after === undefined) {
    return (
      <Text
        weight="medium"
        className={before === undefined ? undefined : styles.removed}
      >
        {after ?? before}
      </Text>
    );
  }
  return (
    <span className={styles.change}>
      <Text tone="muted" className={styles.removed}>
        <VisuallyHidden>{t("assistant.change.before")}</VisuallyHidden>
        {before}
      </Text>
      <Icon size="text" directional>
        <Glyph name="arrow-right" />
      </Icon>
      <Text weight="medium">
        <VisuallyHidden>{t("assistant.change.after")}</VisuallyHidden>
        {after}
      </Text>
    </span>
  );
}
