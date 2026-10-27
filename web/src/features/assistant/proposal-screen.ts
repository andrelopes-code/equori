import { matchScreen } from "@/navigation/navigation-map";

// The write tools whose result names a record with a screen: the result field holding the record's
// ID and the screen's path, with $id in place of the ID (P16). The fields come from the tools'
// output schemas.
const screens: Record<string, { field: string; path: string }> = {
  record_transaction: { field: "transaction_id", path: "/transactions/$id" },
  change_transaction: { field: "transaction_id", path: "/transactions/$id" },
  handle_card_purchase: { field: "transaction_id", path: "/transactions/$id" },
  record_investment: { field: "transaction_id", path: "/transactions/$id" },
  manage_occurrence: { field: "transaction_id", path: "/transactions/$id" },
  manage_schedule: { field: "schedule_id", path: "/planning/schedules/$id" },
  manage_budget_or_goal: { field: "budget_id", path: "/planning/budgets/$id" },
  manage_rule: { field: "rule_id", path: "/categories/rules/$id" },
  reconcile_account: { field: "account_id", path: "/accounts/$id" },
  manage_card: { field: "account_id", path: "/cards/$id" },
};

// The screen of the record an executed proposal wrote, when the navigation map has one.
export function proposalScreen(
  tool: string,
  result: unknown,
): string | undefined {
  const entry = screens[tool];
  if (entry === undefined || typeof result !== "object" || result === null)
    return undefined;
  const id = (result as Record<string, unknown>)[entry.field];
  if (typeof id !== "string" || id === "") return undefined;
  const path = entry.path.replace("$id", encodeURIComponent(id));
  return matchScreen(path) === undefined ? undefined : path;
}
