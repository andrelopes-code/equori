import { CollapsibleTrigger } from "@slotted/react/collapsible";

import { sourceIcon } from "@/features/assistant/message/source-icon";
import type { SourceEntry } from "@/features/assistant/message/source-steps";
import styles from "@/features/assistant/message/turn-activity.module.css";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";

interface SourcePillProps {
  entries: SourceEntry[];
  summary: string;
}

// The folded line of a turn's sources: up to three source icons, then the count text.
export function SourcePill({ entries, summary }: SourcePillProps) {
  return (
    <CollapsibleTrigger>
      <span className={styles.stack} aria-hidden="true">
        {entries.slice(0, 3).map((entry) => (
          <span key={entry.tool} data-source-icon>
            <AssistantIcon name={sourceIcon(entry.tool)} />
          </span>
        ))}
      </span>

      {summary}
    </CollapsibleTrigger>
  );
}
