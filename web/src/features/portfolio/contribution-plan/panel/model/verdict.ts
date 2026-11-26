import type { components } from "@/api/schema.gen";
import { heldText } from "@/features/portfolio/contribution-plan/list/row-text";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import {
  type CriterionView,
  answerOf,
  effectiveAnswer,
  pointsOf,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-view";
import type { TFunction } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];
type Group = Plan["classes"][number];
type Member = Group["members"][number];
type Money = components["schemas"]["Money"];

export interface Verdict {
  title: string;
  body: string;
  // What the reader may press: free the asset for the month, or take that back.
  action?: "release" | "wait";
}

interface VerdictInput {
  t: TFunction;
  locale: string;
  money: (m: Money) => string;
  // The saved group and asset: what holds.
  cls: Group;
  member: Member;
  criteria: readonly CriterionView[];
  // The asset and the group of the split, and whether it set the holds aside.
  forgone: Money | undefined;
  holdsIgnored: boolean;
}

// What the criteria do to an asset this month, in words.
export function assetVerdict(input: VerdictInput): Verdict {
  const { t, cls, member, criteria, forgone, holdsIgnored, money } = input;
  const heldBy = member.held_by ?? [];

  if (member.held === true && holdsIgnored) {
    return {
      title: t("contributionPlan.panel.allWait"),
      body: t("contributionPlan.panel.allWaitBody"),
    };
  }

  if (member.held === true) {
    return {
      title: t("contributionPlan.panel.waits"),
      body:
        forgone !== undefined && forgone.amount > 0
          ? t("contributionPlan.panel.moved", { amount: money(forgone) })
          : heldText(t, cls, heldBy[0] ?? 0),
      action: "release",
    };
  }

  if (member.released === true && heldBy.length > 0) {
    return {
      title: t("contributionPlan.panel.released"),
      body: t("contributionPlan.panel.releasedBody"),
      action: "wait",
    };
  }

  if ((member.warned_by?.length ?? 0) > 0) {
    return {
      title: t("contributionPlan.panel.warned"),
      body: t("contributionPlan.panel.warnedBody"),
    };
  }

  if (criteria.length === 0) {
    return {
      title: t("contributionPlan.panel.noCriteria"),
      body: t("contributionPlan.panel.noCriteriaBody"),
    };
  }

  return freeVerdict(input);
}

// What the criteria do this month to a group that is bought as a whole.
export function groupVerdict({
  t,
  money,
  cls,
  forgone,
  holdsIgnored,
}: Pick<
  VerdictInput,
  "t" | "money" | "cls" | "forgone" | "holdsIgnored"
>): Verdict {
  if (cls.held && holdsIgnored) {
    return {
      title: t("contributionPlan.panel.allWait"),
      body: t("contributionPlan.panel.allWaitBody"),
    };
  }

  if (cls.held) {
    return {
      title: t("contributionPlan.panel.waits"),
      body:
        forgone !== undefined && forgone.amount > 0
          ? t("contributionPlan.panel.moved", { amount: money(forgone) })
          : t("contributionPlan.panel.groupHeld"),
      action: "release",
    };
  }

  if (
    cls.members.some((m) => m.released === true && (m.held_by?.length ?? 0) > 0)
  ) {
    return {
      title: t("contributionPlan.panel.released"),
      body: t("contributionPlan.panel.releasedBody"),
      action: "wait",
    };
  }

  return cls.questions.length === 0
    ? {
        title: t("contributionPlan.panel.noCriteria"),
        body: t("contributionPlan.panel.noCriteriaBody"),
      }
    : {
        title: t("contributionPlan.panel.normal"),
        body: t("contributionPlan.panel.normalBody"),
      };
}

function freeVerdict({
  t,
  locale,
  cls,
  member,
  criteria,
}: VerdictInput): Verdict {
  const holding = criteria.filter((c) => c.counts && c.effect === "hold");

  if (holding.length > 0) {
    const answered = holding.every(
      (c) => effectiveAnswer(answerOf(member, c)) === "yes",
    );

    return {
      title: t("contributionPlan.panel.free"),
      body: t(
        answered
          ? "contributionPlan.panel.freeAnswered"
          : "contributionPlan.panel.freeUnanswered",
      ),
    };
  }

  return {
    title: t("contributionPlan.panel.normal"),
    body: weighText({ t, locale, cls, member, criteria }),
  };
}

// The points and the ideal of an asset whose group derives them.
function weighText({
  t,
  locale,
  cls,
  member,
  criteria,
}: Pick<VerdictInput, "t" | "locale" | "cls" | "member" | "criteria">): string {
  if (!cls.question_ideals || member.target_bp === undefined) {
    return t("contributionPlan.panel.normalBody");
  }

  const points = pointsOf(member, criteria);
  const share = shareText(member.target_bp / 10000, locale);

  return points === undefined
    ? t("contributionPlan.panel.equalShare", { share })
    : t("contributionPlan.panel.points", {
        yes: String(points.yes),
        count: String(points.count),
        share,
      });
}
