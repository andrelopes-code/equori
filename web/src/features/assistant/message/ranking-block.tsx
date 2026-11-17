import { Text } from "@slotted/react/typography";

import { AnswerBlockFrame } from "@/features/assistant/message/answer-block-frame";
import type { BlockRow } from "@/features/assistant/message/answer-blocks";
import styles from "@/features/assistant/message/answer-blocks.module.css";
import { cx } from "@/ui/cx";

interface RankingBlockProps {
  head: [string, string];
  rows: BlockRow[];
  numbered: boolean;
}

// A ranking: bars in the table's order sharing the largest value. A zero is written, not drawn.
export function RankingBlock({ head, rows, numbered }: RankingBlockProps) {
  const largest = Math.max(...rows.map((row) => row.value));

  return (
    <AnswerBlockFrame icon="tag" head={head} rows={rows}>
      <div className={styles.ranking}>
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={cx(
              styles.rank,
              numbered && styles.numbered,
              row.value === 0 && styles.zero,
            )}
          >
            {numbered && (
              <Text size="xs" tone="muted" className={styles.index}>
                {index + 1}
              </Text>
            )}

            <Text size="sm" className={styles.key}>
              {row.label}
            </Text>

            <Text size="sm" className={styles.value}>
              {row.text}
            </Text>

            <span className={styles.rankTrack}>
              {row.value > 0 && (
                <i
                  style={{
                    inlineSize: `${String((row.value / largest) * 100)}%`,
                  }}
                />
              )}
            </span>
          </div>
        ))}
      </div>
    </AnswerBlockFrame>
  );
}
