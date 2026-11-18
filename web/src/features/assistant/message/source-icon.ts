import type { AssistantIconName } from "@/features/assistant/panel/assistant-icon";

// The icon of each read tool a turn consults (spec 2026-11-15, section 3).
const sources: Record<string, AssistantIconName> = {
  list_accounts: "wallet",
  get_balances: "wallet",
  get_account_details: "wallet",
  get_account_history: "chart",
  project_balance: "chart",
  search_transactions: "search",
  get_transaction: "search",
  get_category_totals: "tag",
  explain_categorization: "tag",
  list_payees_and_tags: "tag",
  list_rules: "rules",
  list_schedules: "calendar",
  get_budgets_and_goals: "calendar",
  get_portfolio: "trend",
  get_market_data: "trend",
  get_statement: "receipt",
  get_tax_year: "receipt",
  get_imports: "receipt",
  get_help: "book",
};

// The icon of each write tool a proposal runs (spec 2026-11-15, section 4).
const actions: Record<string, AssistantIconName> = {
  categorize_transactions: "tag",
  manage_rule: "wand",
  void_transaction: "ban",
  record_transaction: "receipt",
  change_transaction: "receipt",
  settle_statement: "receipt",
  manage_schedule: "repeat",
  manage_occurrence: "repeat",
  record_investment: "trend",
  transfer_custody: "trend",
  record_corporate_action: "trend",
  manage_instrument: "trend",
  manage_card: "card",
  handle_card_purchase: "card",
  manage_accounts_and_payees: "wallet",
  reconcile_account: "wallet",
  manage_budget_or_goal: "calendar",
};

export function sourceIcon(tool: string): AssistantIconName {
  return sources[tool] ?? "dot";
}

export function actionIcon(tool: string): AssistantIconName {
  return actions[tool] ?? "dot";
}
