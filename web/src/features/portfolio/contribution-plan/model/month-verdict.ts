import type { components } from "@/api/schema.gen";
import {
  positive,
  receivingEntries,
} from "@/features/portfolio/contribution-plan/model/shopping-list";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
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
}

// More receivers than this are counted, not named: the sentence never fills the line.
const maxNamed = 2;

// The sentence that says where this month's money goes (spec, Screen, This month).
export function monthVerdict(view: Plan, deps: VerdictDeps): string {
  const { t, money, list, memberName } = deps;

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

  if (entries.length > maxNamed) return manyPurchases(entries, view, deps);

  const apply = t("contributionPlan.verdictApply", {
    list: list(
      entries.map((e) =>
        t("contributionPlan.verdictItem", {
          amount: money(e.cost),
          name: e.name,
        }),
      ),
    ),
  });

  return withRest(apply, view, t);
}

function manyPurchases(
  entries: ShoppingEntry[],
  view: Plan,
  deps: VerdictDeps,
): string {
  const { t, money } = deps;
  const first = entries[0];
  const total = {
    amount: entries.reduce((sum, e) => sum + e.cost.amount, 0),
    currency: first?.cost.currency ?? view.total.currency,
  };
  const apply = t("contributionPlan.verdictMany", {
    amount: money(total),
    count: entries.length,
  });

  return withRest(apply, view, t);
}

function withRest(apply: string, view: Plan, t: TFunction): string {
  const rest = view.classes.some((c) => !positive(c.amount));

  return rest ? `${apply} ${t("contributionPlan.verdictRest")}` : apply;
}
