import type { ReactNode } from "react";

import styles from "@/features/assistant/message/assistant-turn.module.css";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";

interface AssistantTurnProps {
  // The turn is still running: the mark carries the ring of the composer's colours.
  thinking: boolean;
  children: ReactNode;
}

// An assistant turn hangs from the assistant's mark and a rail that runs to its end.
export function AssistantTurn({ thinking, children }: AssistantTurnProps) {
  return (
    <div className={styles.turn}>
      <div className={styles.rail} aria-hidden="true">
        <span
          className={styles.mark}
          data-turn-mark=""
          data-thinking={thinking ? "" : undefined}
        >
          <AssistantIcon name="spark" />
        </span>

        <span className={styles.line} />
      </div>

      {children}
    </div>
  );
}
