import { Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import styles from "@/features/assistant/ask/assistant-ask.module.css";
import { askAssistant } from "@/features/assistant/model/ask-assistant";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import { useT } from "@/i18n/i18n-provider";
import { StepGlyph } from "@/ui/navigation/step-glyph";

interface AssistantAskProps {
  // What the composer receives: a search, or the title of the page the reader is on.
  question: string;
  // sm drops the line that says what the assistant takes with it.
  size?: "sm" | "md";
}

// Families read: button (one fill per variant, no ring and no second line). The way to the
// assistant from a page is this product's identity, the mark inside the ring it wears while it
// answers; not a Slotted finding (help spec, HP12).
export function AssistantAsk({ question, size = "md" }: AssistantAskProps) {
  const t = useT();

  return (
    <button
      className={styles.assistantAsk}
      data-size={size}
      type="button"
      onClick={() => {
        askAssistant(question);
      }}
    >
      <span className={styles.assistantMark}>
        <span className={styles.assistantGlyph}>
          <AssistantIcon name="sparkles" />
        </span>
      </span>

      <span className={styles.assistantText}>
        <span className={styles.assistantTitle}>
          {t("assistant.ask.title")}
        </span>
        {size === "md" && (
          <Text
            size="sm"
            tone="muted"
            className={styles.assistantAbout}
            render={(props) => <span {...props} />}
          >
            {t("assistant.ask.about", { question })}
          </Text>
        )}
      </span>

      <span className={styles.assistantGo}>
        <Icon size="sm">
          <StepGlyph direction="next" />
        </Icon>
      </span>
    </button>
  );
}
