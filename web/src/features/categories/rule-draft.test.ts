import { describe, expect, it } from "vitest";

import {
  draftProblems,
  emptyRuleDraft,
  operatorsFor,
  prefilledDraft,
  withField,
} from "@/features/categories/rule-draft";

describe("operatorsFor", () => {
  it("offers the operators A21 allows for each field", () => {
    expect(operatorsFor("description")).toEqual([
      "contains",
      "equals",
      "starts_with",
      "regex",
      "in_list",
    ]);
    expect(operatorsFor("amount")).toEqual([
      "less_than",
      "greater_than",
      "equals",
      "between",
    ]);
    expect(operatorsFor("installment")).toEqual(["equals"]);
  });
});

describe("withField", () => {
  it("resets the operator and the value when the field changes", () => {
    const condition = {
      field: "description" as const,
      operator: "contains" as const,
      value: "uber",
    };
    expect(withField(condition, "installment")).toEqual({
      field: "installment",
      operator: "equals",
      value: true,
    });
    expect(withField(condition, "payee")).toEqual({
      field: "payee",
      operator: "equals",
      value: null,
    });
  });
});

describe("draftProblems", () => {
  it("names the empty values, a missing name and a missing action", () => {
    const draft = emptyRuleDraft();
    expect(draftProblems(draft)).toEqual({
      name: "ruleDraft.nameRequired",
      "conditions[0].value": "ruleDraft.valueRequired",
      "actions[0].category_id": "ruleDraft.categoryRequired",
    });
  });

  it("asks a split for one remainder part and parts that each name a category", () => {
    const draft = {
      ...emptyRuleDraft(),
      name: "Split",
      conditions: [
        {
          field: "description" as const,
          operator: "contains" as const,
          value: "x",
        },
      ],
      actions: [
        {
          type: "split" as const,
          parts: [
            { category_id: "a", percent: 5000 },
            { category_id: "", percent: 5000 },
          ],
        },
      ],
    };
    expect(draftProblems(draft)).toEqual({
      "actions[0].parts[1].category_id": "ruleDraft.categoryRequired",
      "actions[0].parts": "ruleDraft.oneRemainder",
    });
  });

  it("refuses a category and a split in one rule", () => {
    const draft = {
      ...emptyRuleDraft(),
      name: "Both",
      conditions: [
        {
          field: "description" as const,
          operator: "contains" as const,
          value: "x",
        },
      ],
      actions: [
        { type: "set_category" as const, category_id: "a" },
        {
          type: "split" as const,
          parts: [
            { category_id: "a", percent: 5000 },
            { category_id: "b", remainder: true },
          ],
        },
      ],
    };
    expect(draftProblems(draft)).toEqual({
      actions: "ruleDraft.categoryAndSplit",
    });
  });
});

describe("prefilledDraft", () => {
  it("starts from the payee, else the description, and the category", () => {
    expect(
      prefilledDraft({ payee: "p1", category: "c1", name: "iFood" }),
    ).toMatchObject({
      name: "iFood",
      conditions: [{ field: "payee", operator: "equals", value: "p1" }],
      actions: [{ type: "set_category", category_id: "c1" }],
    });
    expect(prefilledDraft({ description: "UBER *TRIP" })).toMatchObject({
      conditions: [
        { field: "description", operator: "contains", value: "UBER *TRIP" },
      ],
      actions: [{ type: "set_category", category_id: "" }],
    });
  });
});
