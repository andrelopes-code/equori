import type { LimitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";

const percentBase = 100;

// The number the field draws for a stored limit: 0.12 of a rate reads 12. Null for an empty limit.
export function limitNumber(
  criterion: LimitCriterion,
  limit: string,
): number | null {
  if (limit === "") return null;

  return criterion.unit === "percent"
    ? round(Number(limit) * percentBase, 2)
    : Number(limit);
}

// The limit the plan stores for the number of the field, "" for an empty field: four decimals at
// most, as the contract reads (AC11).
export function limitText(
  criterion: LimitCriterion,
  value: number | null,
): string {
  if (value === null || !Number.isFinite(value)) return "";

  const stored = criterion.unit === "percent" ? value / percentBase : value;

  return stored
    .toFixed(4)
    .replace(/\.?0+$/, "")
    .replace(/^-0$/, "0");
}

// Whether the server accepts the limit (AC10, AC11).
export function limitHolds(criterion: LimitCriterion, limit: string): boolean {
  if (limit === "") return false;

  const value = Number(limit);
  const whole = criterion.unit !== "years" || Number.isInteger(value);

  return whole && value >= criterion.least && value <= criterion.greatest;
}

// The bounds of the field, in the unit it draws.
export function limitBounds(criterion: LimitCriterion): {
  min: number;
  max: number;
} {
  const factor = criterion.unit === "percent" ? percentBase : 1;

  return { min: criterion.least * factor, max: criterion.greatest * factor };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
