import type { components } from "@/api/schema.gen";
import {
  fearGreedFact,
  limitCriterion,
} from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import type {
  Effect,
  Review,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-effect";
import { figureText } from "@/features/portfolio/contribution-plan/criteria/model/figure-text";
import { limitNumber } from "@/features/portfolio/contribution-plan/criteria/model/limit-value";
import type { Answer } from "@/features/portfolio/contribution-plan/panel/model/criteria-edits";
import type {
  AnswerView,
  CriterionView,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-view";
import { reasonText } from "@/features/instruments";
import { formatDate, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type Detail = components["schemas"]["ContributionFactDetail"];

export const answerKeys = {
  auto: "contributionPlan.answer.auto",
  yes: "contributionPlan.answer.yes",
  no: "contributionPlan.answer.no",
  na: "contributionPlan.answer.na",
} as const satisfies Record<Answer, string>;

export const effectKeys = {
  warn: "contributionPlan.effect.warn",
  hold: "contributionPlan.effect.hold",
  weigh: "contributionPlan.effect.weigh",
} as const satisfies Record<Effect, string>;

export const reviewKeys = {
  0: "contributionPlan.review.none",
  1: "contributionPlan.review.month",
  3: "contributionPlan.review.quarter",
  6: "contributionPlan.review.half",
  12: "contributionPlan.review.year",
} as const satisfies Record<Review, string>;

// "Fear & Greed até 25": the criterion with its limit, in the unit of its figure.
export function criterionTitle(
  locale: string,
  { fact, limit, text }: CriterionView,
): string {
  const criterion = limitCriterion(fact);
  if (criterion === undefined || limit === "") return text;

  const number = limitNumber(criterion, limit) ?? 0;
  const written = numberFormatter(locale, {
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(number);

  return criterion.unit === "percent"
    ? `${text} ${written}%`
    : `${text} ${written}`;
}

// "Segura a compra · todo mês": the effect, and the reminder where there is one.
export function settingsText(
  t: TFunction,
  { effect, review, fact }: CriterionView,
): string {
  const word = t(effectKeys[effect]);

  return fact !== "" || review === 0
    ? word
    : t("contributionPlan.panel.settings", {
        effect: word,
        review: t(reviewKeys[review]).toLocaleLowerCase(),
      });
}

// "Sim · 8,2" or why equori gives no answer.
export function factText(
  t: TFunction,
  locale: string,
  criterion: CriterionView,
  answer: AnswerView,
): string {
  if (!criterion.counts) return t("contributionPlan.panel.noLimit");
  if (answer.fact === "none" || answer.fact === undefined) {
    return reasonOf(t, criterion, answer.detail);
  }

  const word = t(answerKeys[answer.fact]);
  const figure = answer.detail.value;

  return figure === undefined
    ? word
    : t("contributionPlan.panel.answerFigure", {
        answer: word,
        figure: figureText(
          locale,
          limitCriterion(criterion.fact)?.unit ?? "times",
          figure,
        ),
      });
}

// Where an automatic answer comes from, and the day it reads.
export function sourceText(
  t: TFunction,
  locale: string,
  criterion: CriterionView,
  answer: AnswerView,
): string {
  const source =
    criterion.fact === fearGreedFact
      ? t("contributionPlan.panel.autoIndex")
      : t("contributionPlan.panel.auto");
  const { date } = answer.detail;

  return date === undefined
    ? source
    : t("contributionPlan.panel.autoDated", {
        source,
        date: formatDate(date, locale),
      });
}

export function answeredText(
  t: TFunction,
  locale: string,
  answer: AnswerView,
): string {
  if (answer.own === undefined) return t("contributionPlan.panel.unanswered");
  if (answer.date === null) return t("contributionPlan.panel.answeredBefore");

  return t("contributionPlan.panel.answeredOn", {
    date: formatDate(answer.date, locale),
  });
}

function reasonOf(
  t: TFunction,
  { fact }: CriterionView,
  { reason }: Detail,
): string {
  if (reason === "index_off") return t("contributionPlan.panel.indexOff");
  if (reason === "no_report") return t("contributionPlan.panel.noReport");
  if (reason === undefined || fact === fearGreedFact) {
    return t("contributionPlan.panel.noData");
  }

  return reasonText(t, reason);
}
