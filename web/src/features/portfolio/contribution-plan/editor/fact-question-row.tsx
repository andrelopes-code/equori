import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { RemoveButton } from "@/features/portfolio/contribution-plan/editor/remove-button";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { factText } from "@/features/portfolio/contribution-plan/model/fact-labels";
import { useT } from "@/i18n/i18n-provider";

interface FactQuestionRowProps {
  index: number;
  q: number;
  fact: string;
  // The stored text, drawn when the catalog of the web lacks the fact.
  stored: string;
  editor: PlanEditor;
}

// A question the filings answer: its text read-only, the note and the remove button.
export function FactQuestionRow({
  index,
  q,
  fact,
  stored,
  editor,
}: FactQuestionRowProps) {
  const t = useT();

  const n = String(q + 1);
  const text = factText(t, fact, stored);

  return (
    <div className={styles.questionRow}>
      <Text size="sm" tone="muted" className={styles.questionNumber}>
        {n}
      </Text>

      <div className={styles.factText}>
        <Text size="sm" truncate title={text}>
          {text}
        </Text>

        <Text size="sm" tone="muted" className={styles.factNote}>
          {t("contributionPlan.facts.note")}
        </Text>
      </div>

      <RemoveButton
        label={t("contributionPlan.questions.remove", { n })}
        onRemove={() => {
          editor.removeQuestion(index, q);
        }}
      />
    </div>
  );
}
