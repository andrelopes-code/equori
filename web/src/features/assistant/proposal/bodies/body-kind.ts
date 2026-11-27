export type BodyKind =
  | "categorize"
  | "rule"
  | "void"
  | "record"
  | "schedule"
  | "ticket"
  | "limit"
  | "payment"
  | "file"
  | "goal"
  | "budget"
  | "fields";

const BODY_KINDS = new Map<string, BodyKind>(
  Object.entries({
    categorize_transactions: "categorize",
    "manage_rule.create_rule": "rule",
    "manage_rule.change_rule": "rule",
    "manage_rule.accept_suggestion": "rule",
    void_transaction: "void",
    record_transaction: "record",
    "manage_schedule.create": "schedule",
    "manage_schedule.change_terms": "schedule",
    record_brokerage_note: "ticket",
    record_fixed_income: "ticket",
    transfer_custody: "ticket",
    "manage_card.set_credit_limit": "limit",
    "settle_statement.pay": "payment",
    import_statement_file: "file",
    import_price_file: "file",
    import_investment_file: "file",
    attach_file: "file",
    "manage_budget_or_goal.create_goal": "goal",
    "manage_budget_or_goal.set_budget_amount": "budget",
    "manage_budget_or_goal.create_budget": "budget",
  } satisfies Record<string, BodyKind>),
);

// Every kind of these tools is an investment operation.
const TICKETS = ["record_investment.", "record_corporate_action."];

export function bodyKind(action: string): BodyKind {
  if (TICKETS.some((prefix) => action.startsWith(prefix))) return "ticket";

  return BODY_KINDS.get(action) ?? "fields";
}
