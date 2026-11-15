import { Text } from "@slotted/react/typography";

import { AnswerBlockFrame } from "@/features/assistant/message/answer-block-frame";
import type { BlockRow } from "@/features/assistant/message/answer-blocks";
import styles from "@/features/assistant/message/answer-blocks.module.css";
import { CompareDelta } from "@/features/assistant/message/compare-delta";

interface CompareBlockProps {
  head: [string, string];
  rows: BlockRow[];
}

// Two periods compared: paired bars from zero on one axis, the difference written in words.
export function CompareBlock({ head, rows }: CompareBlockProps) {
  const [first, second] = rows;

  if (first === undefined || second === undefined) return null;

  const longest = Math.max(first.value, second.value);

  return (
    <AnswerBlockFrame
      icon="tag"
      head={head}
      rows={rows}
      end={<CompareDelta first={first.value} second={second.value} />}
    >
      <div className={styles.compare}>
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={index === 0 ? styles.reference : styles.subject}
          >
            <Text size="sm" className={styles.key}>
              {row.label}
            </Text>

            <span className={styles.track}>
              <i
                style={{
                  inlineSize: `${String(barPercent(row.value, longest))}%`,
                }}
              />
            </span>

            <Text size="sm" className={styles.value}>
              {row.text}
            </Text>
          </div>
        ))}
      </div>
    </AnswerBlockFrame>
  );
}

function barPercent(value: number, longest: number): number {
  return longest > 0 ? (Math.max(value, 0) / longest) * 100 : 0;
}
