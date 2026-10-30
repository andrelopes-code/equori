import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/assistant/assistant-panel.module.css";

interface AssistantNoteProps {
  tone: "warning" | "danger";
  // Announces the note when it appears while the reader works.
  live?: boolean;
  children: ReactNode;
}

// Families read: icon, typography. One line of warning inside the thread: a mark and the sentence in
// the tone's ink, without the box of an alert.
export function AssistantNote({
  tone,
  live = false,
  children,
}: AssistantNoteProps) {
  return (
    <Text
      size="sm"
      tone={tone}
      className={styles.note}
      role={live ? "status" : undefined}
    >
      <span className={styles.noteMark}>
        <Icon size="text">
          <Glyph name={tone === "danger" ? "circle-alert" : "triangle-alert"} />
        </Icon>
      </span>
      <span>{children}</span>
    </Text>
  );
}
