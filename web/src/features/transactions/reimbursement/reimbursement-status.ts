export interface StatusRow {
  description: string;
  checked: boolean;
  amount: number;
  remaining: number;
}

export type StatusLine =
  | { tone: "danger"; kind: "error"; text: string }
  | { tone: "danger"; kind: "zero" | "above"; description: string }
  | { tone: "danger"; kind: "over" }
  | { tone: "muted"; kind: "none" }
  | { tone: "muted"; kind: "count"; count: number };

// RD4: what the line under the score says, by precedence. A line in the danger tone also keeps
// the submit disabled (RD5).
export function statusLine(
  rows: readonly StatusRow[],
  leftover: number,
  error: string | null,
): StatusLine {
  if (error !== null) return { tone: "danger", kind: "error", text: error };

  const checked = rows.filter((row) => row.checked);
  const zero = checked.find((row) => row.amount <= 0);
  if (zero !== undefined)
    return { tone: "danger", kind: "zero", description: zero.description };

  const above = checked.find((row) => row.amount > row.remaining);
  if (above !== undefined)
    return { tone: "danger", kind: "above", description: above.description };

  if (leftover < 0) return { tone: "danger", kind: "over" };

  if (checked.length === 0) return { tone: "muted", kind: "none" };

  return { tone: "muted", kind: "count", count: checked.length };
}

// RD3: the share of the inflow the meter fills, capped at the whole.
export function meterFraction(allocated: number, inflow: number): number {
  if (inflow <= 0) return 0;

  return Math.min(1, allocated / inflow);
}
