import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type RuleCondition = components["schemas"]["RuleCondition"];
type RuleAction = components["schemas"]["RuleAction"];
type Money = components["schemas"]["Money"];

export interface RuleWords {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  // The name of a payee, an account or a category path, by id.
  name: (id: string) => string;
  money: (money: Money) => string;
}

const fieldWords: Record<RuleCondition["field"], MessageKey> = {
  description: "rule.field.description",
  raw_description: "rule.field.raw_description",
  payee: "rule.field.payee",
  amount: "rule.field.amount",
  absolute_amount: "rule.field.absolute_amount",
  account: "rule.field.account",
  account_kind: "rule.field.account_kind",
  source: "rule.field.source",
  weekday: "rule.field.weekday",
  day_of_month: "rule.field.day_of_month",
  installment: "rule.field.installment",
};

const operatorWords: Record<RuleCondition["operator"], MessageKey> = {
  equals: "rule.op.equals",
  contains: "rule.op.contains",
  starts_with: "rule.op.starts_with",
  regex: "rule.op.regex",
  between: "rule.op.between",
  greater_than: "rule.op.greater_than",
  less_than: "rule.op.less_than",
  in_list: "rule.op.in_list",
};

function isMoney(value: unknown): value is Money {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Money).amount === "number" &&
    typeof (value as Money).currency === "string"
  );
}

// One value of a condition in the words of its field (A21 value types).
function valueWords(
  field: RuleCondition["field"],
  value: unknown,
  words: RuleWords,
): string {
  if (isMoney(value)) return words.money(value);
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  switch (field) {
    case "description":
    case "raw_description":
      return `“${value}”`;
    case "payee":
    case "account":
      return words.name(value);
    case "account_kind":
      return words.t(`kind.${value}` as MessageKey);
    case "source":
      return words.t(`origin.${value}` as MessageKey);
    case "weekday":
      return words.t(`weekday.${value}` as MessageKey);
    default:
      return value;
  }
}

export function conditionSentence(
  condition: RuleCondition,
  words: RuleWords,
): string {
  const { t } = words;
  if (condition.field === "installment") {
    return condition.value === true
      ? t("rule.installment.yes")
      : t("rule.installment.no");
  }
  const field = t(fieldWords[condition.field]);
  const operator = t(operatorWords[condition.operator]);
  const values = Array.isArray(condition.value)
    ? condition.value
    : [condition.value];
  const each = values.map((v) => valueWords(condition.field, v, words));
  const value =
    condition.operator === "between"
      ? t("rule.range", { from: each[0] ?? "", to: each[1] ?? "" })
      : each.join(", ");
  return `${field} ${operator} ${value}`;
}

// percent is in basis points.
function partWords(
  part: components["schemas"]["RuleSplitPart"],
  words: RuleWords,
): string {
  const share =
    part.percent !== undefined
      ? `${String(part.percent / 100)}%`
      : part.amount !== undefined
        ? words.money(part.amount)
        : words.t("rule.split.rest");
  return `${words.name(part.category_id)} ${share}`;
}

export function actionSentence(action: RuleAction, words: RuleWords): string {
  const { t } = words;
  switch (action.type) {
    case "set_category":
      return t("rule.action.set_category", {
        category: words.name(action.category_id ?? ""),
      });
    case "set_payee":
      return t("rule.action.set_payee", {
        payee: words.name(action.payee_id ?? ""),
      });
    case "add_tags":
      return t("rule.action.add_tags", {
        tags: (action.tags ?? []).join(", "),
      });
    case "split":
      return t("rule.action.split", {
        parts: (action.parts ?? []).map((p) => partWords(p, words)).join(", "),
      });
    case "transfer":
      return t("rule.action.transfer", {
        account: words.name(action.account_id ?? ""),
      });
    case "mark_reimbursable":
      return t("rule.action.mark_reimbursable", {
        account: words.name(action.account_id ?? ""),
      });
  }
}
