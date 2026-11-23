import type { components } from "@/api/schema.gen";
import type { TFunction } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];

// The groups the criteria are offered for: they hold an instrument as a chosen asset.
export function criteriaGroups(
  classes: Group[],
): { group: Group; index: number }[] {
  return classes
    .map((group, index) => ({ group, index }))
    .filter(
      ({ group }) =>
        group.rules.length === 0 &&
        group.members.some((m) => m.instrument !== undefined),
    );
}

// How the ideal of each asset of a group is set, in words.
export function groupStateText(t: TFunction, group: Group): string {
  const count = group.questions.length;

  if (count === 0) {
    return t(
      group.members.some((m) => m.target_bp !== undefined)
        ? "contributionPlan.criteria.stateTyped"
        : "contributionPlan.criteria.stateWhole",
    );
  }

  return t(
    count === 1
      ? "contributionPlan.criteria.stateOne"
      : "contributionPlan.criteria.stateMany",
    {
      count: String(count),
      automatic: String(
        group.question_facts.filter((fact) => fact !== "").length,
      ),
    },
  );
}
