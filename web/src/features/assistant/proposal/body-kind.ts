export type BodyKind =
  | "categorize"
  | "rule"
  | "void"
  | "record"
  | "schedule"
  | "investment"
  | "limit"
  | "payment"
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
    "record_investment.buy": "investment",
    "record_investment.sell": "investment",
    "manage_card.set_credit_limit": "limit",
    "settle_statement.pay": "payment",
  } satisfies Record<string, BodyKind>),
);

export function bodyKind(action: string): BodyKind {
  return BODY_KINDS.get(action) ?? "fields";
}
