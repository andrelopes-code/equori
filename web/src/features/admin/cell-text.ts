import { formatPlain } from "@/i18n/format";

export interface CellContext {
  // Display names by record ID: accounts, payees, institutions.
  names: ReadonlyMap<string, string>;
  scaleOf: (code: string) => number;
}

interface Money {
  amount: number;
  currency: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isMoney(value: unknown): value is Money {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 2 &&
    typeof candidate.amount === "number" &&
    typeof candidate.currency === "string"
  );
}

export function cellText(value: unknown, ctx: CellContext): string {
  if (value === undefined || value === null) return "";
  if (isMoney(value)) {
    return `${formatPlain(value.amount, ctx.scaleOf(value.currency))} ${value.currency}`;
  }
  if (typeof value === "string") {
    const name = uuid.test(value) ? ctx.names.get(value) : undefined;
    return name === undefined ? value : `${name} · ${value.slice(0, 8)}`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

interface PostingLike {
  amount: Money;
  weight?: Money;
}

// A posting counts by its weight when it has one, so a balanced transaction sums to zero.
export function postingSums(
  postings: readonly PostingLike[],
): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const posting of postings) {
    const value = posting.weight ?? posting.amount;
    sums[value.currency] = (sums[value.currency] ?? 0) + value.amount;
  }
  return sums;
}

export function fillPath(
  template: string,
  params: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined || value === ""
      ? whole
      : encodeURIComponent(value);
  });
}
