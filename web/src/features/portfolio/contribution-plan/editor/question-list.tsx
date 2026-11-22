import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { FactQuestionRow } from "@/features/portfolio/contribution-plan/editor/fact-question-row";
import { MethodBlock } from "@/features/portfolio/contribution-plan/editor/method-block";
import { RemoveButton } from "@/features/portfolio/contribution-plan/editor/remove-button";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { canUseMethod } from "@/features/portfolio/contribution-plan/model/fact-answers";
import { maxQuestions } from "@/features/portfolio/contribution-plan/model/question-edits";
import { useT } from "@/i18n/i18n-provider";

interface QuestionListProps {
  index: number;
  questions: string[];
  // One fact key per question, "" for the investor's own.
  facts: string[];
  editor: PlanEditor;
}

// The questions of a group: the method row, the hint, one row per question and the add button.
export function QuestionList({
  index,
  questions,
  facts,
  editor,
}: QuestionListProps) {
  const t = useT();

  const hint = t("contributionPlan.questions.hint");
  const methodOffered = canUseMethod(questions, facts);

  return (
    <div className={styles.questions}>
      {methodOffered && <MethodBlock index={index} editor={editor} />}

      <Text size="sm" tone="muted" truncate title={hint}>
        {hint}
      </Text>

      {questions.map((text, q) => {
        const n = String(q + 1);
        const fact = facts[q] ?? "";

        if (fact !== "") {
          return (
            <FactQuestionRow
              key={n}
              index={index}
              q={q}
              fact={fact}
              stored={text}
              editor={editor}
            />
          );
        }

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
