import type { ReactNode } from "react";

import { Text } from "@slotted/react/typography";

import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import type { AssistantIconName } from "@/features/assistant/panel/assistant-icon";
import type { BlockRow } from "@/features/assistant/message/answer-blocks";
import styles from "@/features/assistant/message/answer-blocks.module.css";
import { useT } from "@/i18n/i18n-provider";

interface AnswerBlockFrameProps {
  icon: AssistantIconName;
  head: [string, string];
  rows: BlockRow[];
  // The comparison's difference chip, at the end of the head.
  end?: ReactNode;
  children: ReactNode;
}

// The frame of an answer block: the head and the accessible name that joins every row.
export function AnswerBlockFrame({
  icon,
  head,
  rows,
  end,
  children,
}: AnswerBlockFrameProps) {
  const t = useT();

  const label = rows
    .map((row) =>
      t("assistant.block.item", { label: row.label, value: row.text }),
    )
    .join("; ");

  return (
    <div className={styles.block} role="img" aria-label={label}>
      <div className={styles.head}>
        <span className={styles.icon}>
          <AssistantIcon name={icon} />
        </span>

        <Text size="xs" tone="muted">
          {head.join(" · ")}
        </Text>

        {end !== undefined && <span className={styles.end}>{end}</span>}
      </div>

      {children}
    </div>
  );
}
