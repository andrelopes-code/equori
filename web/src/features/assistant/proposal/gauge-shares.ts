export interface GaugeShares {
  // Percent of the track the current limit fills.
  current: number;
  // Percent where the hatched stretch between the two limits starts; it ends at the track's end.
  changeStart: number;
}

// Both limits are decimal strings of one currency; the larger one is the end of the track. A
// ratio for drawing, never an amount.
export function gaugeShares(current: string, requested: string): GaugeShares {
  const now = Number(current);
  const next = Number(requested);
  const end = Math.max(now, next);

  if (!(end > 0)) return { current: 0, changeStart: 0 };

  return {
    current: (now / end) * 100,
    changeStart: (Math.min(now, next) / end) * 100,
  };
}
