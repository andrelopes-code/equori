import {
  gainShare,
  grossOf,
} from "@/features/portfolio/projection/model/gain-tax";

// The tax as it stands at the withdrawal age: the basis is a share of the value there.
export interface NeededTax {
  rate: number;
  basisShare: number;
  inflation: number;
}

// Halvings of the bracket: the amount is right to the minor unit under 10^15.
const halvings = 60;

const untaxed: NeededTax = { rate: 0, basisShare: 1, inflation: 0 };

// PX5, PX14: the value at the withdrawal age that pays `dues`, one amount per month, at the monthly
// `rate`. Without a tax it is their present value; with one, the smallest value that lasts, between
// that and the one that pays the whole tax.
export function amountNeeded(
  dues: readonly number[],
  rate: number,
  tax?: NeededTax,
): number {
  const net = dues.reduceRight((value, due) => (value + due) / (1 + rate), 0);
  if (tax === undefined) return net;

  let low = net;
  let high = net / (1 - tax.rate);
  for (let i = 0; i < halvings; i++) {
    const middle = (low + high) / 2;
    if (lasts(middle, dues, rate, tax)) high = middle;
    else low = middle;
  }

  return high;
}

// PX20: the highest constant total income that `value` and the other incomes pay in every month of
// `others`; it is not proportional to the value.
export function sustainedTotal(
  value: number,
  others: readonly number[],
  rate: number,
  tax?: NeededTax,
): number {
  const ofOne = amountNeeded(Array<number>(others.length).fill(1), rate, tax);
  let low = 0;
  let high = value / ofOne + Math.max(...others);
  for (let i = 0; i < halvings; i++) {
    const middle = (low + high) / 2;
    const dues = others.map((other) => Math.max(middle - other, 0));
    if (lasts(value, dues, rate, tax ?? untaxed)) low = middle;
    else high = middle;
  }

  return low;
}

function lasts(
  start: number,
  dues: readonly number[],
  rate: number,
  tax: NeededTax,
): boolean {
  let value = start;
  let basis = start * tax.basisShare;

  for (const due of dues) {
    value *= 1 + rate;
    basis /= 1 + tax.inflation;
    const gross = grossOf(due, gainShare(value, basis), tax.rate);
    if (gross > value) return false;

    basis *= value === 0 ? 0 : 1 - gross / value;
    value -= gross;
  }

  return true;
}

// PX5: the monthly income a value sustains at a rate per year in basis points.
export function sustainedIncome(value: number, rateBp: number): number {
  return (value * rateBp) / 10000 / 12;
}

// PX6: the share of the way, null when the amount needed is absent or zero.
export function wayShare(today: number, needed: number | null): number | null {
  if (needed === null || needed === 0) return null;

  return today / needed;
}
