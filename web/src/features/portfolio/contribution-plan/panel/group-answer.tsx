import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AnswerControl } from "@/features/portfolio/contribution-plan/panel/answer-control";
import { setAnswer } from "@/features/portfolio/contribution-plan/panel/model/criteria-edits";
import {
  type CriterionView,
  answerOf,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-view";
import {
  answerKeys,
  factText,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-words";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];

interface GroupAnswerProps {
  cls: Group;
  member: Member;
  name: string;
  criterion: CriterionView;
  criteria: Criteria;
  readOnly: boolean;
}

// The answer of one asset in the view of its group, with the ideal the criteria give it.
export function GroupAnswer({
  cls,
  member,
  name,
  criterion,
  criteria,
  readOnly,
}: GroupAnswerProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();

  const answer = answerOf(member, criterion);
  const given =
    !answer.overrides && (answer.fact === "yes" || answer.fact === "no");
  const asks = !given && criterion.counts;
  const ideal = cls.question_ideals ? member.target_bp : undefined;

  return (
    <div className={styles.answer}>
      <Text size="sm" weight="semibold" className={styles.answerName}>
        {name}
      </Text>

      {!asks && <Text size="sm">{factText(t, locale, criterion, answer)}</Text>}

      {asks && readOnly && (
        <Text size="sm">
          {answer.own === undefined
            ? t("contributionPlan.panel.unanswered")
            : t(answerKeys[answer.own])}
        </Text>
      )}

      {asks && !readOnly && (
        <AnswerControl
          label={t("contributionPlan.panel.answerOfAsset", {
            asset: name,
            name: criterion.text,
          })}
          value={answer.own}
          pending={criteria.pending}
          onAnswer={(next) => {
            criteria.save(
              setAnswer(
                { group: cls.name, question: criterion.question },
                member,
                next,
                today,
              ),
            );
          }}
        />
      )}

      <Text size="xs" tone="muted" className={styles.answerEnd}>
        {ideal === undefined
          ? ""
          : t("contributionPlan.markerIdeal", {
              share: shareText(ideal / 10000, locale),
            })}
      </Text>
    </div>
  );
}
