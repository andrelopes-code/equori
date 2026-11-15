import { Text } from "@slotted/react/typography";

import { sourceIcon } from "@/features/assistant/message/source-icon";
import styles from "@/features/assistant/message/turn-activity.module.css";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";

export interface SourceEntry {
  tool: string;
  label: string;
}

interface SourceStepsProps {
  entries: SourceEntry[];
  running: boolean;
}

// Workaround for Slotted issue #113: MessageActivityStep has no icon slot, so the steps are an
// own element. Families read: typography.
export function SourceSteps({ entries, running }: SourceStepsProps) {
  return (
    <ol className={styles.steps}>
      {entries.map((entry, i) => {
        const current = running && i === entries.length - 1;

        return (
          <li
            key={entry.tool}
            className={styles.step}
            aria-current={current ? "step" : undefined}
          >
            <span className={styles.tile} aria-hidden="true">
              <AssistantIcon
                name={current ? sourceIcon(entry.tool) : "check"}
              />
            </span>

            <Text size="sm" tone={current ? "default" : "muted"}>
              {entry.label}
            </Text>
          </li>
        );
      })}
    </ol>
  );
}
