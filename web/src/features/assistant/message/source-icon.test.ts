import { describe, expect, it } from "vitest";

import {
  actionIcon,
  sourceIcon,
} from "@/features/assistant/message/source-icon";

describe("sourceIcon", () => {
  it.each([
    ["list_accounts", "wallet"],
    ["get_balances", "wallet"],
    ["get_account_details", "wallet"],
    ["get_account_history", "chart"],
    ["project_balance", "chart"],
    ["search_transactions", "search"],
    ["get_transaction", "search"],
    ["get_category_totals", "tag"],
    ["explain_categorization", "tag"],
    ["list_payees_and_tags", "tag"],
    ["list_rules", "rules"],
    ["list_schedules", "calendar"],
    ["get_budgets_and_goals", "calendar"],
    ["get_portfolio", "trend"],
    ["get_market_data", "trend"],
    ["get_statement", "receipt"],
    ["get_tax_year", "receipt"],
    ["get_imports", "receipt"],
    ["get_help", "book"],
    ["web_search", "search"],
    ["unknown_tool", "dot"],
  ])("%s draws %s", (tool, icon) => {
    expect(sourceIcon(tool)).toBe(icon);
  });
});

describe("actionIcon", () => {
  it.each([
    ["categorize_transactions", "tag"],
    ["manage_rule", "wand"],
    ["void_transaction", "ban"],
    ["record_transaction", "receipt"],
    ["change_transaction", "receipt"],
    ["settle_statement", "receipt"],
    ["manage_schedule", "repeat"],
    ["manage_occurrence", "repeat"],
    ["record_investment", "trend"],
    ["manage_instrument", "trend"],
    ["manage_card", "card"],
    ["handle_card_purchase", "card"],
    ["manage_accounts_and_payees", "wallet"],
    ["reconcile_account", "wallet"],
    ["manage_budget_or_goal", "calendar"],
    ["unknown_tool", "dot"],
  ])("%s draws %s", (tool, icon) => {
    expect(actionIcon(tool)).toBe(icon);
  });
});
