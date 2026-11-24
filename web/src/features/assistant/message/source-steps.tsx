import { MessageActivity, MessageActivityStep } from "@slotted/react/message";

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

// The sources of a turn, one step each: the last one is current while the turn runs.
export function SourceSteps({ entries, running }: SourceStepsProps) {
  return (
    <MessageActivity variant="plain" shimmer={false} className={styles.steps}>
      {entries.map((entry, i) => (
        <MessageActivityStep
          key={entry.tool}
          status={running && i === entries.length - 1 ? "current" : "complete"}
          icon={<AssistantIcon name={sourceIcon(entry.tool)} />}
        >
          {entry.label}
        </MessageActivityStep>
      ))}
    </MessageActivity>
  );
}
