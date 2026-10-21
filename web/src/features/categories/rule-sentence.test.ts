import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";

import {
  actionSentence,
  conditionSentence,
} from "@/features/categories/rule-sentence";
import type { RuleWords } from "@/features/categories/rule-sentence";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";

const t = (key: MessageKey, vars?: Record<string, string | number>) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    vars?.[name] === undefined ? whole : String(vars[name]),
  );

const words: RuleWords = {
  t,
  name: (id) =>
    ({ p1: "iFood", food: "Food › Delivery", nubank: "Nubank" })[id] ?? id,
  money: (m) => `R$${(m.amount / 100).toFixed(2)}`,
};

type RuleCondition = components["schemas"]["RuleCondition"];
type RuleAction = components["schemas"]["RuleAction"];

describe("conditionSentence", () => {
  it.each<[RuleCondition, string]>([
    [
      { field: "description", operator: "contains", value: "uber" },
      "description contains “uber”",
    ],
    [
      { field: "payee", operator: "in_list", value: ["p1", "p2"] },
      "payee is one of iFood, p2",
    ],
    [
      {
        field: "amount",
        operator: "between",
        value: [
          { amount: -5000, currency: "BRL" },
          { amount: -1000, currency: "BRL" },
        ],
      },
      "amount is between R$-50.00 and R$-10.00",
    ],
    [
      { field: "weekday", operator: "equals", value: "saturday" },
      "weekday is Saturday",
    ],
    [
      { field: "installment", operator: "equals", value: true },
      "is an installment",
    ],
    [
      { field: "account_kind", operator: "equals", value: "credit_card" },
      "account kind is credit card",
    ],
  ])("reads %o", (condition, text) => {
    expect(conditionSentence(condition, words)).toBe(text);
  });
});

describe("actionSentence", () => {
  it.each<[RuleAction, string]>([
    [
      { type: "set_category", category_id: "food" },
      "categorize as Food › Delivery",
    ],
    [{ type: "add_tags", tags: ["work", "trip"] }, "add tags work, trip"],
    [
      {
        type: "split",
        parts: [
          { category_id: "food", percent: 2500 },
          { category_id: "nubank", remainder: true },
        ],
      },
      "split: Food › Delivery 25%, Nubank the rest",
    ],
    [
      { type: "transfer", account_id: "nubank" },
      "mark as a transfer to Nubank",
    ],
  ])("reads %o", (action, text) => {
    expect(actionSentence(action, words)).toBe(text);
  });
});
