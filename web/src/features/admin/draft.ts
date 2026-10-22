import { formatPlain, parseAmount } from "@/i18n/format";

// A draft is a body template under edit: money amounts are decimal text, numbers may be text.
export type Draft = unknown;

type ScaleOf = (code: string) => number;

interface MoneyDraft {
  amount: number | string;
  currency: string;
}

export function isMoney(value: unknown): value is MoneyDraft {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  const candidate = value as Record<string, unknown>;
  return (
    keys.length === 2 &&
    typeof candidate.currency === "string" &&
    (typeof candidate.amount === "number" ||
      typeof candidate.amount === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toDraft(value: unknown, scaleOf: ScaleOf): Draft {
  if (isMoney(value)) {
    return {
      amount:
        typeof value.amount === "number"
          ? formatPlain(value.amount, scaleOf(value.currency))
          : value.amount,
      currency: value.currency,
    };
  }
  if (Array.isArray(value)) return value.map((item) => toDraft(item, scaleOf));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toDraft(item, scaleOf)]),
    );
  }
  return value;
}

// Keys whose template may hold "" for an optional integer.
const numericKeys = new Set([
  "interval",
  "day_of_month",
  "ordinal",
  "business_day_ordinal",
  "count",
  "grace_days",
  "match_tolerance_bp",
  "installment_count",
  "closing_day",
  "due_day",
  "expected_version",
  "from_installment",
  "to_installment",
  "foreign_charge_rate_bp",
  "scale",
  "header_rows",
  "percent",
  "limit",
  "year",
]);

function leafToBody(key: string, value: unknown, template: unknown): unknown {
  if (
    typeof value === "string" &&
    (typeof template === "number" || numericKeys.has(key)) &&
    /^-?\d+$/.test(value.trim())
  ) {
    return Number(value.trim());
  }
  return value;
}

// Drops empty text and money without an amount, so optional fields stay absent.
export function toBody(
  draft: Draft,
  template: unknown,
  scaleOf: ScaleOf,
  key = "",
): unknown {
  if (isMoney(draft)) {
    if (typeof draft.amount === "number") return draft;
    if (draft.amount.trim() === "") return undefined;
    const minor = parseAmount(draft.amount, scaleOf(draft.currency), "en");
    return { amount: minor ?? draft.amount, currency: draft.currency };
  }
  if (Array.isArray(draft)) {
    const items = Array.isArray(template) ? template : [];
    return draft.map((item, index) =>
      toBody(item, items[index] ?? items[0], scaleOf, key),
    );
  }
  if (isRecord(draft)) {
    const shape = isRecord(template) ? template : {};
    const entries = Object.entries(draft)
      .map(([name, item]) => [name, toBody(item, shape[name], scaleOf, name)])
      .filter(([, item]) => item !== undefined && item !== "");
    return Object.fromEntries(entries);
  }
  return leafToBody(key, draft, template);
}

export type FieldKind =
  | { kind: "text" | "date" | "month" | "account" | "payee" | "institution" }
  | { kind: "enum"; options: readonly string[] };

// Option lists by key; a key shared by two schemas lists both, and the current value picks one.
const enums: Record<string, readonly (readonly string[])[]> = {
  class: [["asset", "liability", "equity", "income", "expense"]],
  kind: [
    [
      "checking",
      "savings",
      "cash",
      "wallet",
      "benefit",
      "reserve",
      "brokerage",
      "receivable",
      "credit_card",
      "loan",
      "payable",
    ],
    ["bill", "income", "subscription", "transfer", "savings"],
  ],
  yield_mode: [["none", "auto"]],
  basis: [["booked", "settled"]],
  status: [["pending", "cleared", "reconciled"]],
  card_role: [["charge", "credit", "payment"]],
  frequency: [["daily", "weekly", "monthly", "yearly"]],
  weekday: [
    [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ],
  ],
  adjustment: [["none", "following", "preceding", "modified_following"]],
  due_date_adjustment: [
    ["none", "following", "preceding", "modified_following"],
  ],
  closing_day_assignment: [["next", "closing"]],
  side: [["buy", "sell"]],
  income_type: [["dividend", "jcp", "interest", "coupon"]],
  type: [
    [
      "currency",
      "stock",
      "reit",
      "etf",
      "depositary_receipt",
      "fixed_income",
      "fund",
      "crypto",
    ],
    [
      "set_category",
      "set_payee",
      "add_tags",
      "split",
      "transfer",
      "mark_reimbursable",
    ],
    [
      "refund_of",
      "reimbursement_of",
      "cancellation_of",
      "anticipation_of",
      "chargeback_of",
      "correction_of",
    ],
  ],
  outcome: [["won", "lost"]],
  resolution: [["adjustment", "transactions_added"]],
  source: [["manual", "import", "aggregator"]],
  action: [["match", "create", "discard"]],
  match_type: [["equals", "starts_with", "contains", "regex"]],
  field: [
    [
      "description",
      "raw_description",
      "payee",
      "amount",
      "absolute_amount",
      "account",
      "account_kind",
      "source",
      "weekday",
      "day_of_month",
      "installment",
    ],
  ],
  operator: [
    [
      "equals",
      "contains",
      "starts_with",
      "regex",
      "between",
      "greater_than",
      "less_than",
      "in_list",
    ],
  ],
  aggregator: [["pluggy"]],
  exchange: [["BVMF"]],
  delimiter: [["comma", "semicolon", "tab", "pipe"]],
  date_layout: [["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"]],
  decimal_separator: [[",", "."]],
  amount_sign: [["as_is", "inverted"]],
  state: [
    ["expected", "overdue", "realized", "skipped"],
    ["pending", "accepted", "dismissed"],
    [
      "received",
      "matched",
      "created",
      "needs_review",
      "discarded",
      "withdrawn",
    ],
  ],
};

const accountKeys = new Set([
  "account_id",
  "card_account_id",
  "from_account_id",
  "to_account_id",
  "cash_account_id",
  "counterpart_id",
  "parent_id",
]);

const dateKeys = new Set([
  "date",
  "from",
  "to",
  "opened_on",
  "closed_on",
  "due_on",
  "settled_on",
  "start",
  "until",
  "resolved_on",
  "sync_from",
]);

const monthKeys = new Set([
  "month",
  "statement",
  "first_statement",
  "credit_statement",
  "target_statement",
]);

export function fieldKind(key: string, value: unknown): FieldKind {
  const lists = enums[key];
  if (lists !== undefined) {
    const options =
      lists.find((list) => list.includes(String(value))) ?? lists[0] ?? [];
    return { kind: "enum", options };
  }
  if (accountKeys.has(key) || key.endsWith("category_id")) {
    return { kind: "account" };
  }
  if (key === "payee_id") return { kind: "payee" };
  if (key === "institution_id") return { kind: "institution" };
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { kind: "date" };
  }
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    return { kind: "month" };
  }
  if (dateKeys.has(key)) return { kind: "date" };
  if (monthKeys.has(key)) return { kind: "month" };
  return { kind: "text" };
}
