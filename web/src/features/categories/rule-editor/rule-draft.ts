import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type RuleInput = components["schemas"]["RuleInput"];
export type RuleCondition = components["schemas"]["RuleCondition"];
export type RuleActionInput = components["schemas"]["RuleAction"];
export type ConditionField = RuleCondition["field"];
export type ConditionOperator = RuleCondition["operator"];

export const limits = { conditions: 20, actions: 10, parts: 10 } as const;

// A21: the operators each field takes, the most used first.
const operators: Record<ConditionField, ConditionOperator[]> = {
  description: ["contains", "equals", "starts_with", "regex", "in_list"],
  raw_description: ["contains", "equals", "starts_with", "regex", "in_list"],
  payee: ["equals", "in_list"],
  amount: ["less_than", "greater_than", "equals", "between"],
  absolute_amount: ["greater_than", "less_than", "equals", "between"],
  account: ["equals", "in_list"],
  account_kind: ["equals", "in_list"],
  source: ["equals", "in_list"],
  weekday: ["equals", "in_list"],
  day_of_month: ["equals", "greater_than", "less_than", "between", "in_list"],
  installment: ["equals"],
};

export const conditionFields = Object.keys(operators) as ConditionField[];

export function operatorsFor(field: ConditionField): ConditionOperator[] {
  return operators[field];
}

// The value a new operator starts from: a list for in_list, a pair for between, nothing to fill.
export function defaultValue(
  field: ConditionField,
  operator: ConditionOperator,
): unknown {
  if (field === "installment") return true;
  if (operator === "in_list") return [];
  if (operator === "between") return [null, null];
  return field === "description" || field === "raw_description" ? "" : null;
}

export function withField(
  condition: RuleCondition,
  field: ConditionField,
): RuleCondition {
  const operator = operators[field][0] ?? "equals";
  return { field, operator, value: defaultValue(field, operator) };
}

export function withOperator(
  condition: RuleCondition,
  operator: ConditionOperator,
): RuleCondition {
  const keep =
    (operator === "in_list") === (condition.operator === "in_list") &&
    (operator === "between") === (condition.operator === "between");
  return {
    ...condition,
    operator,
    value: keep ? condition.value : defaultValue(condition.field, operator),
  };
}

export interface RuleDraft extends RuleInput {
  enabled: boolean;
  stop_processing: boolean;
}

export function emptyRuleDraft(): RuleDraft {
  return {
    name: "",
    enabled: true,
    stop_processing: false,
    conditions: [{ field: "description", operator: "contains", value: "" }],
    actions: [{ type: "set_category", category_id: "" }],
  };
}

export function prefilledDraft(prefill: {
  payee?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  name?: string | undefined;
}): RuleDraft {
  const draft = emptyRuleDraft();
  const condition: RuleCondition =
    prefill.payee !== undefined
      ? { field: "payee", operator: "equals", value: prefill.payee }
      : {
          field: "description",
          operator: "contains",
          value: prefill.description ?? "",
        };
  return {
    ...draft,
    name: prefill.name ?? "",
    conditions: [condition],
    actions: [{ type: "set_category", category_id: prefill.category ?? "" }],
  };
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value))
    return value.length === 0 || value.some((v) => isEmpty(v));
  return false;
}

// BD-03: what the server would refuse, keyed by the node's path, before any request.
export function draftProblems(draft: RuleDraft): Record<string, MessageKey> {
  const problems: Record<string, MessageKey> = {};
  if (draft.name.trim() === "") problems.name = "ruleDraft.nameRequired";
  if (draft.conditions.length === 0)
    problems.conditions = "ruleDraft.conditionRequired";
  draft.conditions.forEach((condition, i) => {
    if (isEmpty(condition.value)) {
      problems[`conditions[${String(i)}].value`] = "ruleDraft.valueRequired";
    }
  });
  if (draft.actions.length === 0) problems.actions = "ruleDraft.actionRequired";
  const deciders = draft.actions.filter(
    (a) => a.type === "set_category" || a.type === "split",
  );
  draft.actions.forEach((action, i) => {
    const at = `actions[${String(i)}]`;
    switch (action.type) {
      case "set_category":
        if (!action.category_id)
          problems[`${at}.category_id`] = "ruleDraft.categoryRequired";
        return;
      case "set_payee":
        if (!action.payee_id)
          problems[`${at}.payee_id`] = "ruleDraft.payeeRequired";
        return;
      case "add_tags":
        if ((action.tags ?? []).length === 0)
          problems[`${at}.tags`] = "ruleDraft.tagsRequired";
        return;
      case "transfer":
      case "mark_reimbursable":
        if (!action.account_id)
          problems[`${at}.account_id`] = "ruleDraft.accountRequired";
        return;
      case "split": {
        const parts = action.parts ?? [];
        parts.forEach((part, j) => {
          if (!part.category_id) {
            problems[`${at}.parts[${String(j)}].category_id`] =
              "ruleDraft.categoryRequired";
          }
        });
        if (parts.filter((p) => p.remainder === true).length !== 1) {
          problems[`${at}.parts`] = "ruleDraft.oneRemainder";
        } else if (parts.length < 2) {
          problems[`${at}.parts`] = "ruleDraft.twoParts";
        }
        return;
      }
    }
  });
  if (deciders.length > 1) {
    // The pair is the problem; the actions' own gaps wait until one of the two goes.
    return {
      ...Object.fromEntries(
        Object.entries(problems).filter(([key]) => !key.startsWith("actions[")),
      ),
      actions: "ruleDraft.categoryAndSplit",
    };
  }
  return problems;
}

export function draftFromRule(rule: components["schemas"]["Rule"]): RuleDraft {
  return {
    name: rule.name,
    enabled: rule.enabled,
    stop_processing: rule.stop_processing,
    conditions: rule.conditions,
    actions: rule.actions,
  };
}

// The action a type starts from when the reader picks it.
export function emptyAction(type: RuleActionInput["type"]): RuleActionInput {
  switch (type) {
    case "set_category":
      return { type, category_id: "" };
    case "set_payee":
      return { type, payee_id: "" };
    case "add_tags":
      return { type, tags: [] };
    case "split":
      return {
        type,
        parts: [
          { category_id: "", percent: 5000 },
          { category_id: "", remainder: true },
        ],
      };
    case "transfer":
    case "mark_reimbursable":
      return { type, account_id: "" };
  }
}
