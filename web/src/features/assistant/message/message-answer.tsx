import type { MarkdownNode } from "@slotted/core/markdown";
import { Text } from "@slotted/react/typography";

import { AnswerSegment } from "@/features/assistant/message/answer-segment";
import { answerSegments } from "@/features/assistant/message/answer-blocks";
import styles from "@/features/assistant/panel/assistant-panel.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";

interface MessageAnswerProps {
  // The parsed answer; null when the answer holds no text.
  tree: MarkdownNode | null;
}

// P10: an answer spans the thread without a bubble.
export function MessageAnswer({ tree }: MessageAnswerProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { hidden } = usePrivacy();

  // Privacy on: no block, the table stays Markdown with masked amounts (spec 8).
  const segments =
    tree !== null && !hidden ? answerSegments(tree, locale) : undefined;

  return (
    <div className={styles.answer}>
      {tree === null && (
        <Text size="md" tone="muted">
          {t("assistant.empty_answer")}
        </Text>
      )}
      {tree !== null && segments === undefined && (
        <AnswerSegment segment={{ kind: "markdown", tree }} />
      )}
      {segments?.map((segment, index) => (
        <AnswerSegment key={index} segment={segment} />
      ))}
    </div>
  );
}
