// Basis points past the largest share, so the longest bar and its target tick stay inside the track.
const margin = 500;

// The track runs from 0 to the largest share drawn on it plus five percentage points.
export function trackScale(shares: readonly (number | undefined)[]): number {
  const drawn = shares.filter((share) => share !== undefined);

  return Math.max(0, ...drawn) + margin;
}
