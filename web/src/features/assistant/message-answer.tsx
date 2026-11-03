import type { MarkdownNode } from "@slotted/core/markdown";
import { Markdown } from "@slotted/react/markdown";
import { Text } from "@slotted/react/typography";

import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";
import { screenLinks } from "@/navigation/screen-links";

interface MessageAnswerProps {
  // The parsed answer; null when the answer holds no text.
  tree: MarkdownNode | null;
}

// P10: an answer spans the thread without a bubble.
export function MessageAnswer({ tree }: MessageAnswerProps) {
  const t = useT();

  return (
    <div className={styles.answer}>
      {tree === null && (
        <Text size="md" tone="muted">
          {t("assistant.empty_answer")}
        </Text>
      )}
      {tree !== null && (
        <Markdown tree={tree} size="md" renderers={screenLinks} />
      )}
    </div>
  );
}
