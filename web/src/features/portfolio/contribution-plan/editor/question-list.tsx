import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { RemoveButton } from "@/features/portfolio/contribution-plan/editor/remove-button";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { maxQuestions } from "@/features/portfolio/contribution-plan/model/question-edits";
import { useT } from "@/i18n/i18n-provider";

interface QuestionListProps {
  index: number;
  questions: string[];
  editor: PlanEditor;
}

// The investor's questions of a group: the hint, one field per question and the add button.
export function QuestionList({ index, questions, editor }: QuestionListProps) {
  const t = useT();

  const hint = t("contributionPlan.questions.hint");

  return (
    <div className={styles.questions}>
      <Text size="sm" tone="muted" truncate title={hint}>
        {hint}
      </Text>

      {questions.map((text, q) => {
        const n = String(q + 1);

        return (
          // The position is the identity of a question: it has no other key.
          <div key={n} className={styles.questionRow}>
            <Text size="sm" tone="muted" className={styles.questionNumber}>
              {n}
            </Text>

            <TextField
              size="sm"
              maxLength={200}
              autoComplete="off"
              aria-label={t("contributionPlan.questions.label", { n })}
              value={text}
              onChange={(event) => {
                editor.setQuestionText(index, q, event.target.value);
              }}
            />

            <RemoveButton
              label={t("contributionPlan.questions.remove", { n })}
              onRemove={() => {
                editor.removeQuestion(index, q);
              }}
            />
          </div>
        );
      })}

      <div className={styles.questionAdd}>
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          start={<Glyph name="plus" />}
          disabled={questions.length >= maxQuestions}
          onClick={() => {
            editor.addQuestion(index);
          }}
        >
          {t("contributionPlan.questions.add")}
        </Button>
      </div>
    </div>
  );
}
