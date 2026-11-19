import type { VerdictPart } from "@/features/assistant/view/verdict-parts";
import styles from "@/features/assistant/view/answer-view.module.css";

interface ViewVerdictProps {
  parts: VerdictPart[];
}

// The conclusion of a view in one sentence; each figure of it in bold.
export function ViewVerdict({ parts }: ViewVerdictProps) {
  if (parts.length === 0) return null;

  return (
    <p className={styles.verdict}>
      {parts.map((part, index) =>
        part.strong ? <strong key={index}>{part.text}</strong> : part.text,
      )}
    </p>
  );
}
