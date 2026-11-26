import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import {
  fearGreedFact,
  limitCriterion,
} from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import {
  type Effect,
  effects,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-effect";
import { AnswerControl } from "@/features/portfolio/contribution-plan/panel/answer-control";
import {
  type CriterionKey,
  removeCriterion,
  setAnswer,
  setEffect,
  setLimit,
  setReview,
  setText,
} from "@/features/portfolio/contribution-plan/panel/model/criteria-edits";
import {
  type CriterionView,
  answerOf,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-view";
import {
  criterionTitle,
  effectKeys,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-words";
import { EditorFoot } from "@/features/portfolio/contribution-plan/panel/editor-foot";
import { LimitField } from "@/features/portfolio/contribution-plan/panel/limit-field";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { QuestionField } from "@/features/portfolio/contribution-plan/panel/question-field";
import { ReviewSelect } from "@/features/portfolio/contribution-plan/panel/review-select";
import { SentimentScale } from "@/features/portfolio/contribution-plan/panel/sentiment-scale";
import { SettingRow } from "@/features/portfolio/contribution-plan/panel/setting-row";
import { usePicked } from "@/features/portfolio/contribution-plan/panel/use-picked";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];

interface CriterionEditorProps {
  cls: Group;
  // The asset whose answer is edited; undefined in the view of the whole group.
  member: Member | undefined;
  criterion: CriterionView;
  criteria: Criteria;
  onRenamed: (question: string) => void;
  onDone: () => void;
}

const hintKeys = {
  warn: "contributionPlan.effect.warnHint",
  hold: "contributionPlan.effect.holdHint",
  weigh: "contributionPlan.effect.weighHint",
} as const satisfies Record<Effect, string>;

// A criterion edited in place: each change is saved when it is made.
export function CriterionEditor({
  cls,
  member,
  criterion,
  criteria,
  onRenamed,
  onDone,
}: CriterionEditorProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const effect = usePicked(criterion.effect, criteria.pending);

  const key: CriterionKey = { group: cls.name, question: criterion.question };
  const limited = limitCriterion(criterion.fact);
  const own = criterion.fact === "";
  const indexed = criterion.fact === fearGreedFact;
  const answer = member === undefined ? undefined : answerOf(member, criterion);
  const automatic = !own && answer?.overrides !== true;
  const limitLabel = t(
    indexed ? "contributionPlan.index.limit" : "contributionPlan.panel.limit",
  );

  function handleEffect(next: string) {
    const chosen = effects.find((e) => e === next);
    if (chosen === undefined) return;

    effect.pick(chosen);
    criteria.save(setEffect(key, chosen), {
      undo: t("contributionPlan.panel.effectChanged"),
    });
  }

  function handleRemove() {
    criteria.save(removeCriterion(key), {
      undo: t("contributionPlan.panel.removed"),
      onSaved: onDone,
    });
  }

  return (
    <li className={styles.cond}>
      {own && (
        <QuestionField
          question={criterion.question}
          others={cls.questions.filter((_, q) => q !== criterion.position)}
          onQuestion={(text) => {
            criteria.save(setText(key, text), {
              onSaved: () => {
                onRenamed(text);
              },
            });
          }}
        />
      )}

      {!own && (
        <Text size="md" weight="medium" className={styles.condQuestion}>
          {criterionTitle(locale, criterion)}
        </Text>
      )}

      {indexed && (
        <SentimentScale
          limit={criterion.limit}
          pending={criteria.pending}
          onLimit={(limit) => {
            criteria.save(setLimit(key, limit));
          }}
        />
      )}

      <div className={styles.sets}>
        {limited !== undefined && (
          <SettingRow
            label={limitLabel}
            {...(criterion.counts || indexed
              ? {}
              : { hint: t("contributionPlan.panel.noLimit") })}
          >
            <LimitField
              criterion={limited}
              limit={criterion.limit}
              {...(indexed ? { label: limitLabel } : {})}
              onLimit={(limit) => {
                criteria.save(setLimit(key, limit));
              }}
            />
          </SettingRow>
        )}

        <SettingRow
          label={t("contributionPlan.panel.effect")}
          hint={t(hintKeys[effect.value])}
        >
          <SegmentedControl
            aria-label={t("contributionPlan.panel.effect")}
            value={effect.value}
            onValueChange={handleEffect}
          >
            {effects.map((each) => (
              <Segment key={each} value={each}>
                {t(effectKeys[each])}
              </Segment>
            ))}
          </SegmentedControl>
        </SettingRow>

        {own && (
          <SettingRow
            label={t("contributionPlan.panel.review")}
            hint={t("contributionPlan.panel.reviewHint")}
          >
            <ReviewSelect
              months={criterion.review}
              pending={criteria.pending}
              onReview={(months) => {
                criteria.save(setReview(key, months));
              }}
            />
          </SettingRow>
        )}

        {member !== undefined && (
          <SettingRow label={t("contributionPlan.panel.answer")}>
            <AnswerControl
              label={t("contributionPlan.panel.answerOf", {
                name: criterion.text,
              })}
              value={automatic ? "auto" : answer?.own}
              automatic={!own}
              pending={criteria.pending}
              onAnswer={(next) => {
                criteria.save(setAnswer(key, member, next, today));
              }}
            />
          </SettingRow>
        )}
      </div>

      <EditorFoot onRemove={handleRemove} onDone={onDone} />
    </li>
  );
}
