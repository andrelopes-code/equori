// A ratio to the median on a log axis from 0.1× to 20×, as a percent of the track.
export function ratioPosition(ratioBP: number): number {
  const ratio = Math.max(ratioBP, 1) / 10000;
  const x = ((Math.log10(ratio) + 1) / Math.log10(200)) * 100;

  return Math.min(100, Math.max(0, x));
}

// Lanes of a beeswarm: a point closer than 3% to the last point of a lane takes the next lane;
// three lanes at −7, 0 and 7 px from the track's middle.
export function lanes(positions: number[]): number[] {
  const order = positions.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const last = [-Infinity, -Infinity, -Infinity];
  const offsets = [0, -7, 7];
  const out: number[] = new Array<number>(positions.length).fill(0);

  for (const { x, i } of order) {
    const lane = last.findIndex((l) => x - l >= 3);
    const chosen = lane === -1 ? 0 : lane;
    last[chosen] = x;
    out[i] = offsets[chosen] ?? 0;
  }

  return out;
}
