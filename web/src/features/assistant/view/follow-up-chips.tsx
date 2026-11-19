import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import { useAsk } from "@/features/assistant/view/ask-context";
import styles from "@/features/assistant/view/answer-view.module.css";
import { useT } from "@/i18n/i18n-provider";

interface FollowUpChipsProps {
  items: string[];
}

// The questions that follow from a view; a click sends one as the next message (V14).
export function FollowUpChips({ items }: FollowUpChipsProps) {
  const t = useT();
  const ask = useAsk();

  if (items.length === 0) return null;

  return (
    <ul className={styles.next} aria-label={t("assistantView.next")}>
      {items.map((q) => (
        <li key={q}>
          <button
            type="button"
            className={styles.chip}
            disabled={ask === undefined}
            onClick={() => {
              ask?.(q);
            }}
          >
            <span className={styles.chipIcon}>
              <AssistantIcon name="corner" />
            </span>
            <span className={styles.chipText}>{q}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
