import type { components } from "@/api/schema.gen";
import { sharesBP } from "@/features/portfolio/portfolio-shares";

export type Position = components["schemas"]["Position"];
export type PositionGroupBy = "account" | "instrument";

export interface PositionRow {
  position: Position;
  // Basis points of the valued total; undefined for a position without a price.
  share: number | undefined;
}

export interface PositionGroup {
  key: string;
  label: string;
  rows: PositionRow[];
  // Sum of the market values of the group's valued rows.
  value: number;
}

// The shares are taken over every valued position, not per group, so the figures add up to the
// total; the rows keep the order of the answer inside a group, and the groups read by label.
export function groupPositions(
  positions: readonly Position[],
  by: PositionGroupBy,
  labelOf: (position: Position) => string,
  tag: string,
): { groups: PositionGroup[]; total: number; unvalued: number } {
  const valued = positions.filter((p) => p.market_value !== undefined);
  const shares = sharesBP(valued.map((p) => p.market_value?.amount ?? 0));
  const shareOf = new Map(valued.map((p, i) => [p, shares[i]]));
  const groups = new Map<string, PositionGroup>();
  for (const position of positions) {
    const key = by === "account" ? position.account_id : position.instrument;
    const group = groups.get(key) ?? {
      key,
      label: by === "account" ? labelOf(position) : position.instrument,
      rows: [],
      value: 0,
    };
    group.rows.push({ position, share: shareOf.get(position) });
    group.value += position.market_value?.amount ?? 0;
    groups.set(key, group);
  }
  return {
    groups: [...groups.values()].sort((a, b) =>
      a.label.localeCompare(b.label, tag),
    ),
    total: valued.reduce((sum, p) => sum + (p.market_value?.amount ?? 0), 0),
    unvalued: positions.length - valued.length,
  };
}
