import type { components } from "@/api/schema.gen";
import { limitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { criterionText } from "@/features/portfolio/contribution-plan/criteria/model/criterion-text";
import type {
  ListRow,
  NoneReason,
} from "@/features/portfolio/contribution-plan/list/list-rows";
import {
  type OrderWords,
  orderText,
} from "@/features/portfolio/contribution-plan/month/order-text";
import type { TFunction } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

const reasonKeys = {
  noIdeal: "contributionPlan.list.noIdeal",
  atIdeal: "contributionPlan.list.atIdeal",
  small: "contributionPlan.list.small",
} as const satisfies Record<NoneReason, string>;

// The second piece of a row: how it is bought, why it waits or why it receives nothing.
export function rowText(row: ListRow, view: Plan, words: OrderWords): string {
  const { t } = words;

  if (row.heldBy !== undefined) {
    return heldText(t, view.classes[row.group], row.heldBy);
  }

  if (row.without.length > 0) {
    return t("contributionPlan.list.without", {
      names: row.without.join(", "),
    });
  }

  if (row.entry?.splitToSee === true) {
    return t("contributionPlan.list.undivided");
  }

  if (row.entry !== undefined) return orderText(row.entry, words) ?? "";

  return row.reason === undefined ? "" : t(reasonKeys[row.reason]);
}

// Why an asset waits: the investor's answer, or the criterion equori answers.
export function heldText(
  t: TFunction,
  cls: Plan["classes"][number] | undefined,
  q: number,
): string {
  const fact = cls?.question_facts[q] ?? "";

  if (fact === "") return t("contributionPlan.list.saidNo");

  const limit = cls?.question_limits[q] ?? "";
  const text = criterionText(t, fact, cls?.questions[q] ?? "");

  return limitCriterion(fact)?.unit === "points" && limit !== ""
    ? t("contributionPlan.list.aboveLimit", { name: text, limit })
    : t("contributionPlan.list.notMet", { name: text });
}
