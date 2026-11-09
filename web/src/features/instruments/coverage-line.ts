import type { components } from "@/api/schema.gen";

type Coverage = components["schemas"]["InstrumentCoverage"];

export type CoverageRange =
  | { kind: "none"; canRequest: boolean }
  | {
      kind: "range";
      first: string;
      last: string;
      count: number;
      source: string | null;
    };

export type HistoryState =
  | { kind: "idle" }
  | { kind: "loading"; from: string }
  | { kind: "failed"; from: string; error: string };

export function coverageRange(c: Coverage): CoverageRange {
  if (c.first === null || c.last === null)
    return { kind: "none", canRequest: c.sources.some((s) => s.enabled) };

  let source: string | null = null;
  let latest = "";
  for (const s of c.sources) {
    if (s.last !== null && s.last > latest) {
      latest = s.last;
      source = s.id;
    }
  }

  return {
    kind: "range",
    first: c.first,
    last: c.last,
    count: c.count,
    source,
  };
}

export function historyState(c: Coverage): HistoryState {
  const rows = c.sources.flatMap((s) =>
    s.enabled && s.history !== null ? [s.history] : [],
  );
  const failed = rows.find((h) => h.error !== null);
  if (failed?.error != null)
    return { kind: "failed", from: failed.from, error: failed.error };

  const pending = rows.filter((h) => !h.done).map((h) => h.from);
  if (pending.length === 0) return { kind: "idle" };

  return { kind: "loading", from: pending.reduce((a, b) => (a < b ? a : b)) };
}

export function quoteAge(c: Coverage, today: string): number | null {
  if (c.last === null || c.sources.some((s) => s.enabled)) return null;

  return Math.round((Date.parse(today) - Date.parse(c.last)) / 86_400_000);
}
