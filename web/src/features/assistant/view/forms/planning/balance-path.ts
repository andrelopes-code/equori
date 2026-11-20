import type { BalanceData } from "@/features/assistant/view/forms/planning/planning-data";

export interface BalanceGeometry {
  // A step path in a 300 × 120 box: flat until each event, then a vertical jump.
  path: string;
  area: string;
  // Height of the zero line, in the box's units; undefined when every balance is above zero.
  zero?: number;
  low: { x: number; y: number };
  // The x of each step, for the readout columns.
  xs: number[];
}

const W = 300;
const H = 120;

const day = (iso: string) =>
  Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );

// The balance from the opening day to the last day, one step per scheduled event.
export function balanceGeometry(d: BalanceData): BalanceGeometry {
  const values = [d.opening.amount, ...d.points.map((p) => p.balance.amount)];
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const range = top - bottom || 1;
  const start = day(d.from);
  const span = day(d.to) - start || 1;
  const x = (iso: string) => ((day(iso) - start) / span) * W;
  const y = (v: number) => H - ((v - bottom) / range) * H;

  let path = `M0 ${y(d.opening.amount).toFixed(1)}`;
  for (const p of d.points)
    path += ` H${x(p.date).toFixed(1)} V${y(p.balance.amount).toFixed(1)}`;
  path += ` H${String(W)}`;

  return {
    path,
    area: `${path} V${y(bottom).toFixed(1)} H0 Z`,
    ...(bottom < 0 ? { zero: y(0) } : {}),
    low: { x: x(d.low.date), y: y(d.low.balance.amount) },
    xs: [0, ...d.points.map((p) => x(p.date))],
  };
}
