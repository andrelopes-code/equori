// The BCB methods stop when the error on the target is below 0.000001 of it (study M2, M3).
const tolerance = 0.000001;
const maxIterations = 200;

// Finds x in [lo, hi] with f(x) = target by bisection, for f monotonic on the range; null when
// the target lies outside f's range there or no x reaches the tolerance in 200 steps.
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  target: number,
): number | null {
  const limit = Math.abs(target) * tolerance || tolerance;
  let gLo = f(lo) - target;
  const gHi = f(hi) - target;
  if (Math.abs(gLo) < limit) return lo;
  if (Math.abs(gHi) < limit) return hi;
  if (Math.sign(gLo) === Math.sign(gHi)) return null;
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const g = f(mid) - target;
    if (Math.abs(g) < limit) return mid;
    if (Math.sign(g) === Math.sign(gLo)) {
      lo = mid;
      gLo = g;
    } else {
      hi = mid;
    }
  }
  return null;
}
