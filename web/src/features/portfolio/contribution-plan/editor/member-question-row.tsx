import { Checkbox } from "@slotted/react/checkbox";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { MemberFactsLine } from "@/features/portfolio/contribution-plan/editor/member-facts-line";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import {
  effectiveAnswers,
  factDecides,
} from "@/features/portfolio/contribution-plan/model/fact-answers";
import { factText } from "@/features/portfolio/contribution-plan/model/fact-labels";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Member = components["schemas"]["ContributionMember"];

interface MemberQuestionRowProps {
  index: number;
  at: number;
  // The row of the view: the answers of the draft and the target the preview derived.
  member: Member;
  name: string;
  questions: string[];
  // One fact key per question, "" for the investor's own.
  facts: string[];
  // Whether the preview derived a target for the group (at least one yes).
  ideals: boolean;
  editor: PlanEditor;
}

// An asset of a group divided by questions: its answers, its count and derived target on one
// line, its facts on the next. An account has no facts.
export function MemberQuestionRow({
  index,
  at,
  member,
  name,
  questions,
  facts,
  ideals,
  editor,
}: MemberQuestionRowProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const answers = member.answers ?? [];
  const yes = effectiveAnswers(answers, member.fact_answers).filter(
    Boolean,
  ).length;
  const bp = member.target_bp;
  const ideal =
    ideals && bp !== undefined
      ? t("contributionPlan.questions.ideal", {
          share: shareText(bp / 10000, tag),
        })
      : "";

  return (
    <div role="listitem" className={styles.questionMember}>
      <div className={styles.questionLine}>
        <Text size="md" className={styles.member}>
          {name}
        </Text>

        <div className={styles.answers}>
          {questions.map((text, q) => {
            const n = String(q + 1);
            const decided = factDecides(member.fact_answers, q);
            const name =
              text === ""
                ? t("contributionPlan.questions.answerLabel", { n })
                : factText(t, facts[q] ?? "", text);

            return (
              <Checkbox
                key={n}
                size="sm"
                aria-label={
                  decided
                    ? t("contributionPlan.facts.answerSuffix", {
                        question: name,
                      })
                    : name
                }
                readOnly={decided}
                checked={
                  decided
                    ? member.fact_answers?.[q] === "yes"
                    : (answers[q] ?? false)
                }
                onCheckedChange={(checked) => {
                  editor.setAnswer(index, at, q, checked);
                }}
              >
                {n}
              </Checkbox>
            );
          })}
        </div>

        <Text size="md" tone="muted" className={styles.questionCount}>
          {t("contributionPlan.questions.count", {
            yes: String(yes),
            count: String(questions.length),
          })}
        </Text>

        <Text size="md" className={styles.questionIdeal}>
          {ideal}
        </Text>
      </div>

      <div className={styles.questionFacts}>
        <MemberFactsLine member={member} facts={facts} />
      </div>
    </div>
  );
}
