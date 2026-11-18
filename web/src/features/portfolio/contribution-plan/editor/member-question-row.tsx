import { Checkbox } from "@slotted/react/checkbox";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AssetFacts } from "@/features/instruments";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
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
  ideals,
  editor,
}: MemberQuestionRowProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const answers = member.answers ?? [];
  const yes = answers.filter(Boolean).length;
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

            return (
              <Checkbox
                key={n}
                size="sm"
                aria-label={
                  text === ""
                    ? t("contributionPlan.questions.answerLabel", { n })
                    : text
                }
                checked={answers[q] ?? false}
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
        {member.instrument === undefined ? (
          <Text size="sm" tone="muted" truncate>
            {t("contributionPlan.questions.noFacts")}
          </Text>
        ) : (
          <AssetFacts code={member.instrument} />
        )}
      </div>
    </div>
  );
}
