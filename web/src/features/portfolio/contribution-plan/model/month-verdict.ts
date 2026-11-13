import type { components } from "@/api/schema.gen";
import {
  positive,
  receivingEntries,
} from "@/features/portfolio/contribution-plan/model/shopping-list";
import type { TFunction } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];
interface MemberRef {
  account_id?: string;
  instrument?: string;
}

export interface VerdictDeps {
  t: TFunction;
  money: (m: Money) => string;
  list: (items: string[]) => string;
  memberName: (ref: MemberRef) => string;
  // A group without a name blocks the preview.
  nameMissing?: boolean;
}

// The sentence that says where this month's money goes (spec, Screen, This month).
export function monthVerdict(view: Plan, deps: VerdictDeps): string {
  const { t, money, list, memberName, nameMissing } = deps;

  if (nameMissing === true) return t("contributionPlan.verdictNameMissing");

  if (view.status === "incomplete" && view.missing.length > 0) {
    return view.missing
      .map((m) =>
        t(
          m.kind === "price"
            ? "contributionPlan.verdictMissingPrice"
            : "contributionPlan.verdictMissingRate",
          { name: m.instrument },
        ),
      )
      .join(" ");
  }

  if (view.amount === undefined) return t("contributionPlan.verdictNoAmount");

  const entries = receivingEntries(view, memberName);
  if (entries.length === 0) return t("contributionPlan.shoppingEmpty");

  const apply = t("contributionPlan.verdictApply", {
    list: list(
      entries.map((e) =>
        t("contributionPlan.verdictItem", {
          amount: money(e.amount),
          name: e.name,
        }),
      ),
    ),
  });
  const rest = view.classes.some((c) => !positive(c.amount));

  return rest ? `${apply} ${t("contributionPlan.verdictRest")}` : apply;
}
