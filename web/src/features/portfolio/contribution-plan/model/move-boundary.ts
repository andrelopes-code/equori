// The grid of a transfer: 0.1% of the portfolio.
const stepBp = 10;

// Transfers basis points between two adjacent targets and leaves every other target alone; the
// sum stays the same. The transfer is snapped to the grid, then clamped so neither target goes
// below 0. A locked neighbour, or a boundary without two groups, leaves the targets unchanged.
export function moveBoundary(
  targets: number[],
  locked: boolean[],
  boundary: number,
  deltaBp: number,
): number[] {
  const left = targets[boundary];
  const right = targets[boundary + 1];
  if (left === undefined || right === undefined) return [...targets];
  if (locked[boundary] === true || locked[boundary + 1] === true) {
    return [...targets];
  }

  const snapped =
    Math.sign(deltaBp) * Math.round(Math.abs(deltaBp) / stepBp) * stepBp;
  const delta = Math.min(Math.max(snapped, -left), right);

  const result = [...targets];
  result[boundary] = left + delta;
  result[boundary + 1] = right - delta;

  return result;
}
