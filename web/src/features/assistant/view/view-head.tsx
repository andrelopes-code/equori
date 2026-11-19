import type { ReactNode } from "react";

import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import type { AssistantIconName } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/view/answer-view.module.css";

interface ViewHeadProps {
  icon: AssistantIconName;
  title: string;
  window: string;
  // The R$ / % switch of a view of shares.
  unit?: ReactNode;
}

// The head of a view: the kind's glyph, the title and the period it covers.
export function ViewHead({ icon, title, window, unit }: ViewHeadProps) {
  return (
    <header className={styles.head}>
      <span className={styles.kind}>
        <AssistantIcon name={icon} />
      </span>

      <span className={styles.title}>{title}</span>
      <span className={styles.window}>{window}</span>
      {unit}
    </header>
  );
}
