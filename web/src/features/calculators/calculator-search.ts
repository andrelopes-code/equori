import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

// A search value longer than this is not an input of a calculator.
const maxLength = 64;
const maxMinor = 10 ** 15;

// The inputs of a calculator, as text, from the address (design §4, "Address"). The router parses
// ?months=12 into a number, so a finite number is kept as its text; any other value is dropped.
export function validateCalculatorSearch(
  raw: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const text =
      typeof value === "string"
        ? value
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : undefined;
    if (text !== undefined && text.length <= maxLength) out[key] = text;
  }
  return out;
}

const integerPattern = /^-?\d+$/;
const decimalPattern = /^-?\d+(\.\d+)?$/;

export function readInt(
  v: string | undefined,
  min: number,
  max: number,
): number | null {
  if (v === undefined || !integerPattern.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

// An amount in minor units: an integer from 0 to 10^15.
export function readMinor(v?: string): number | null {
  return readInt(v, 0, maxMinor);
}

// A rate typed in percent, from −99.99 to 1000, as a fraction.
export function readRate(v?: string): number | null {
  if (v === undefined || !decimalPattern.test(v)) return null;
  const percent = Number(v);
  return percent >= -99.99 && percent <= 1000 ? percent / 100 : null;
}

export function readMonth(v?: string): string | null {
  return v !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

export function readDate(v?: string): string | null {
  if (v === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) ? v : null;
}

// A canonical number goes into the address as a number, so the router writes ?months=12 rather
// than ?months=%2212%22; any other text stays text.
function addressValue(v: string): string | number {
  return decimalPattern.test(v) && String(Number(v)) === v ? Number(v) : v;
}

// The inputs of the open calculator and a setter that replaces the address without a history
// entry per keystroke; a key set to undefined or "" is removed.
export function useCalculatorSearch(): [
  Record<string, string>,
  (patch: Record<string, string | undefined>) => void,
] {
  // The route declares its search without keys; validateCalculatorSearch keeps strings only.
  const search = useSearch({
    from: "/_authed/calculators/$id",
    select: (s: object) => s as Record<string, string>,
  });
  const { id } = useParams({ from: "/_authed/calculators/$id" });
  const navigate = useNavigate();
  const set = useCallback(
    (patch: Record<string, string | undefined>) => {
      void navigate({
        to: "/calculators/$id",
        params: { id },
        replace: true,
        search: (prev) => {
          const next: Record<string, unknown> = {};
          for (const [key, value] of Object.entries({ ...prev, ...patch })) {
            if (typeof value === "string" && value !== "")
              next[key] = addressValue(value);
          }
          return next;
        },
      });
    },
    [navigate, id],
  );
  return [search, set];
}
