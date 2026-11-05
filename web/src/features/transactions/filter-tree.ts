import { ruleFor, setFilter } from "@slotted/core/filter";
import type {
  FilterDescriptor,
  FilterGroup,
  FilterRule,
  NumberOperator,
} from "@slotted/core/filter";

import { decimalText } from "@/features/transactions/decimal-text";

import { patchSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";

// The filter bar edits a tree; the URL keeps one flat value per filter, so the
// tree is derived from the URL and every edit is written back to it.
export const filterFields = {
  account: "account",
  category: "category",
  period: "period",
  payee: "payee",
  tag: "tag",
  amount: "amount",
  uncategorized: "uncategorized",
} as const;

function periodFilter(from?: string, to?: string): FilterDescriptor {
  let operator: "between" | "after" | "before" = "between";
  if (to === undefined) operator = "after";
  else if (from === undefined) operator = "before";
  const condition =
    operator === "before"
      ? { operator, value: to ?? null, end: null }
      : { operator, value: from ?? null, end: to ?? null };
  return { kind: "date", join: "and", conditions: [condition] };
}

// The bar edits the amount as a decimal of the base currency; the URL and the API hold minor units.
// The conversion moves the decimal point in the text of the number, never by division.
function majorToMinor(value: number, scale: number): number {
  return Number(value.toFixed(scale).replace(".", ""));
}

function minorToMajor(minor: number, scale: number): number {
  return Number(decimalText(minor, scale));
}

function amountFilter(
  min: number | undefined,
  max: number | undefined,
  scale: number,
): FilterDescriptor {
  const low = min === undefined ? null : minorToMajor(min, scale);
  const high = max === undefined ? null : minorToMajor(max, scale);
  let condition: {
    operator: NumberOperator;
    value: number | null;
    end: number | null;
  };
  if (low !== null && low === high) {
    condition = { operator: "equals", value: low, end: null };
  } else if (low !== null && high !== null) {
    condition = { operator: "between", value: low, end: high };
  } else if (low !== null) {
    condition = { operator: "greaterThanOrEqual", value: low, end: null };
  } else {
    condition = { operator: "lessThanOrEqual", value: high, end: null };
  }
  return { kind: "number", join: "and", conditions: [condition] };
}

// The API filters by one account_id, a balance account or a category; the bar shows it under
// the field its class belongs to.
export function treeFromSearch(
  search: TransactionSearch,
  isCategory: (id: string) => boolean = () => false,
  scale?: number,
): FilterGroup | null {
  const rules: FilterRule[] = [];
  if (search.account_id !== undefined) {
    rules.push({
      field: isCategory(search.account_id)
        ? filterFields.category
        : filterFields.account,
      filter: setFilter([search.account_id]),
    });
  }
  if (search.from !== undefined || search.to !== undefined) {
    rules.push({
      field: filterFields.period,
      filter: periodFilter(search.from, search.to),
    });
  }
  if (search.payee_id !== undefined) {
    rules.push({
      field: filterFields.payee,
      filter: setFilter([search.payee_id]),
    });
  }
  if (search.tag !== undefined) {
    rules.push({ field: filterFields.tag, filter: setFilter([search.tag]) });
  }
  if (
    scale !== undefined &&
    (search.amount_min !== undefined || search.amount_max !== undefined)
  ) {
    rules.push({
      field: filterFields.amount,
      filter: amountFilter(search.amount_min, search.amount_max, scale),
    });
  }
  if (search.uncategorized === true) {
    rules.push({
      field: filterFields.uncategorized,
      filter: {
        kind: "boolean",
        join: "and",
        conditions: [{ operator: "is", value: true }],
      },
    });
  }
  return rules.length === 0 ? null : { join: "and", rules };
}

// A set field offers many values and the URL holds one: the value the reader
// added last, which is the one that differs from the current URL value, wins.
function single(
  filter: FilterDescriptor | undefined,
  current: string | undefined,
): string | undefined {
  if (filter?.kind !== "set") return undefined;
  const values = filter.conditions[0]?.value ?? [];
  return values.find((v) => v !== current) ?? values[0];
}

function period(filter: FilterDescriptor | undefined): {
  from?: string;
  to?: string;
} {
  const condition = filter?.kind === "date" ? filter.conditions[0] : undefined;
  if (condition === undefined) return {};
  const value = condition.value ?? undefined;
  const end = condition.end ?? undefined;
  const from = value === undefined ? {} : { from: value };
  switch (condition.operator) {
    case "between":
      return { ...from, ...(end === undefined ? {} : { to: end }) };
    case "after":
      return from;
    case "before":
      return value === undefined ? {} : { to: value };
    default:
      return {};
  }
}

function amountRange(
  filter: FilterDescriptor | undefined,
  scale: number,
): { amount_min?: number; amount_max?: number } {
  const condition =
    filter?.kind === "number" ? filter.conditions[0] : undefined;
  const value = condition?.value ?? undefined;
  const end = condition?.end ?? undefined;
  if (condition === undefined || value === undefined || value < 0) return {};
  const minor = majorToMinor(value, scale);
  switch (condition.operator) {
    case "equals":
      return { amount_min: minor, amount_max: minor };
    case "greaterThanOrEqual":
      return { amount_min: minor };
    case "lessThanOrEqual":
      return { amount_max: minor };
    case "between":
      return end === undefined || end < 0
        ? { amount_min: minor }
        : { amount_min: minor, amount_max: majorToMinor(end, scale) };
    default:
      return {};
  }
}

// Account and category share account_id: the one whose value differs from the URL is the one
// the reader just set, and it replaces the other.
function accountOrCategory(
  tree: FilterGroup | null,
  current: string | undefined,
): string | undefined {
  const account = single(ruleFor(tree, filterFields.account), current);
  const category = single(ruleFor(tree, filterFields.category), current);
  if (category !== undefined && category !== current) return category;
  if (account !== undefined && account !== current) return account;
  return category ?? account;
}

export function searchFromTree(
  tree: FilterGroup | null,
  search: TransactionSearch,
  scale?: number,
): TransactionSearch {
  // Without the scale the bar holds no amount rule, so the URL amount stays as it is.
  const amount =
    scale === undefined
      ? {
          amount_min: search.amount_min,
          amount_max: search.amount_max,
        }
      : amountRange(ruleFor(tree, filterFields.amount), scale);
  const uncategorized = ruleFor(tree, filterFields.uncategorized);
  const { from, to } = period(ruleFor(tree, filterFields.period));
  return patchSearch(
    { ...(search.q === undefined ? {} : { q: search.q }) },
    {
      account_id: accountOrCategory(tree, search.account_id),
      payee_id: single(ruleFor(tree, filterFields.payee), search.payee_id),
      tag: single(ruleFor(tree, filterFields.tag), search.tag),
      from,
      to,
      ...amount,
      uncategorized:
        uncategorized?.kind === "boolean" &&
        uncategorized.conditions[0]?.value === true,
    },
  );
}
