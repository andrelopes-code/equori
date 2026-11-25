import { describe, expect, it } from "vitest";

import {
  bodyKind,
  type BodyKind,
} from "@/features/assistant/proposal/bodies/body-kind";

describe("bodyKind", () => {
  const rows: [string, BodyKind][] = [
    ["categorize_transactions", "categorize"],
    ["manage_rule.create_rule", "rule"],
    ["manage_rule.change_rule", "rule"],
    ["manage_rule.accept_suggestion", "rule"],
    ["void_transaction", "void"],
    ["record_transaction", "record"],
    ["manage_schedule.create", "schedule"],
    ["manage_schedule.change_terms", "schedule"],
    ["record_investment.buy", "ticket"],
    ["record_investment.income", "ticket"],
    ["record_investment.correct", "ticket"],
    ["record_brokerage_note", "ticket"],
    ["record_fixed_income", "ticket"],
    ["record_corporate_action.split", "ticket"],
    ["transfer_custody", "ticket"],
    ["manage_card.set_credit_limit", "limit"],
    ["settle_statement.pay", "payment"],
    ["import_statement_file", "file"],
    ["import_price_file", "file"],
    ["attach_file", "file"],
    ["manage_card.add_card", "fields"],
  ];

  it.each(rows)("maps %s to %s", (action, kind) => {
    expect(bodyKind(action)).toBe(kind);
  });
});
