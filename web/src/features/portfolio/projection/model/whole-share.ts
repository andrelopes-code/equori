// What the floating point can lose of a share.
export const shareRounding = 1e-9;

// PX18: a share of the amount needed in whole percent rounded down, so 100% is only a plan that
// sustains the income.
export function wholeShare(share: number): number {
  return Math.floor((share + shareRounding) * 100) / 100;
}
