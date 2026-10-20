import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { actionText, conditionText } from "@/features/admin/rule-text";

type RuleCondition = components["schemas"]["RuleCondition"];
type RuleAction = components["schemas"]["RuleAction"];

const groceries = "1c2d3e4f-0000-4000-8000-000000000001";
const ifood = "1c2d3e4f-0000-4000-8000-000000000002";
const unknown = "9f8e7d6c-0000-4000-8000-000000000003";

const ctx = {
  names: new Map([
    [groceries, "Groceries"],
    [ifood, "iFood"],
  ]),
  scaleOf: () => 2,
};

const BRL = (amount: number) => ({ amount, currency: "BRL" });

describe("conditionText", () => {
  it.each<[RuleCondition, string]>([
    [
      { field: "description", operator: "contains", value: "market" },
      'description contains "market"',
    ],
    [
      { field: "payee", operator: "in_list", value: [ifood, unknown] },
      "payee in_list [iFood, 9f8e7d6c]",
    ],
    [
      {
        field: "absolute_amount",
        operator: "between",
        value: [BRL(1000), BRL(5050)],
      },
      "absolute_amount between [10.00 BRL, 50.50 BRL]",
    ],
    [
      { field: "day_of_month", operator: "equals", value: 5 },
      "day_of_month equals 5",
    ],
    [
      { field: "installment", operator: "equals", value: true },
      "installment equals true",
    ],
  ])("writes %j as %s", (condition, text) => {
    expect(conditionText(condition, ctx)).toBe(text);
  });
});

describe("actionText", () => {
  it.each<[RuleAction, string]>([
    [
      { type: "set_category", category_id: groceries },
      "set_category Groceries",
    ],
    [{ type: "set_payee", payee_id: ifood }, "set_payee iFood"],
    [{ type: "add_tags", tags: ["home", "food"] }, "add_tags home, food"],
    [{ type: "transfer", account_id: unknown }, "transfer 9f8e7d6c"],
    [{ type: "mark_reimbursable" }, "mark_reimbursable"],
    [
      {
        type: "split",
        parts: [
          { category_id: groceries, percent: 6000 },
          { category_id: ifood, amount: BRL(1500) },
          { category_id: unknown, remainder: true },
        ],
      },
      "split Groceries 60.00%, iFood 15.00 BRL, 9f8e7d6c remainder",
    ],
  ])("writes %j as %s", (action, text) => {
    expect(actionText(action, ctx)).toBe(text);
  });
});
