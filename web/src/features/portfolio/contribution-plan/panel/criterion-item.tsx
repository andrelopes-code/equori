import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { fearGreedFact } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { AnswerControl } from "@/features/portfolio/contribution-plan/panel/answer-control";
import {
  type CriterionKey,
  renewAnswer,
  setAnswer,
} from "@/features/portfolio/contribution-plan/panel/model/criteria-edits";
import {
  type CriterionView,
  answerOf,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-view";
import {
  answerKeys,
  answeredText,
  criterionTitle,
  factText,
  settingsText,
  sourceText,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-words";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { SentimentBar } from "@/features/portfolio/contribution-plan/panel/sentiment-bar";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];

interface CriterionItemProps {
  cls: Group;
  member: Member;
  criterion: CriterionView;
  criteria: Criteria;
  readOnly: boolean;
  onEdit: () => void;
}

// A criterion of one asset: its text at full length, the answer, its day and what it does.
export function CriterionItem({
  cls,
  member,
  criterion,
  criteria,
  readOnly,
  onEdit,
}: CriterionItemProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();

  const key: CriterionKey = { group: cls.name, question: criterion.question };
  const answer = answerOf(member, criterion);
  const title = criterionTitle(locale, criterion);
  const own = criterion.fact === "";
  const index = criterion.fact === fearGreedFact;
  // equori gives no answer to a criterion that counts, so the investor may.
  const open = !index && criterion.counts && answer.fact === "none";
  const asks = own || (open && !readOnly) || answer.overrides;

  return (
    <li className={styles.cond}>
      <div className={styles.condTop}>
        <Text size="md" weight="medium" className={styles.condQuestion}>
          {title}
        </Text>

        {!readOnly && (
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("contributionPlan.panel.editNamed", { name: title })}
            onClick={onEdit}
          >
            {t("contributionPlan.panel.edit")}
          </Button>
        )}
      </div>

      <div className={styles.condAnswer}>
        {index && criterion.limit !== "" && (
          <SentimentBar
            today={
              answer.detail.value === undefined
                ? undefined
                : Number(answer.detail.value)
            }
            limit={Number(criterion.limit)}
          />
        )}

        {!own && !answer.overrides && (
          <Text size="sm" weight="semibold">
            {factText(t, locale, criterion, answer)}
          </Text>
        )}

        {asks && readOnly && (
          <Text size="sm" weight="semibold">
            {answer.own === undefined
              ? t("contributionPlan.panel.unanswered")
              : t(answerKeys[answer.own])}
          </Text>
        )}

        {asks && !readOnly && (
          <AnswerControl
            label={t("contributionPlan.panel.answerOf", { name: title })}
            value={answer.own}
            pending={criteria.pending}
            onAnswer={(next) => {
              criteria.save(setAnswer(key, member, next, today));
            }}
          />
        )}
      </div>

      <div className={styles.condMeta}>
        {answer.due && (
          <Text size="xs" weight="semibold">
            {t("contributionPlan.panel.due")}
          </Text>
        )}

        <Text size="xs" tone="muted">
          {own || answer.overrides || (open && answer.own !== undefined)
            ? answeredText(t, locale, answer)
            : sourceText(t, locale, criterion, answer)}
        </Text>

        {answer.due && !readOnly && (
          <Button
            inline
            size="sm"
            onClick={() => {
              criteria.save(renewAnswer(key, member, today));
            }}
          >
            {t("contributionPlan.panel.renew")}
          </Button>
        )}

        <span className={styles.grow} />

        <Text size="xs" tone="muted">
          {settingsText(t, criterion)}
        </Text>
      </div>
    </li>
  );
}
