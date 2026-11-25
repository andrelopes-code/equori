// PX14: the tax on the gain of a withdrawal. `rate` is a fraction; `basis` is the money contributed
// so far in today's money; `inflation` is the monthly rate the basis falls with.
export interface GainTax {
  rate: number;
  basis: number;
  inflation: number;
}

// The part of a value above its basis, never below zero.
export function gainShare(value: number, basis: number): number {
  return value > 0 ? Math.max(1 - basis / value, 0) : 0;
}

// The amount whose net, once the tax on its gain share is paid, is the income.
export function grossOf(income: number, share: number, rate: number): number {
  return income / (1 - rate * share);
}

// The basis after the months of `rows`: it falls with inflation and rises with each contribution.
export function basisAfter(
  basis: number,
  inflation: number,
  rows: readonly { contribution: number }[],
): number {
  return rows.reduce(
    (left, row) => left / (1 + inflation) + row.contribution,
    basis,
  );
}
