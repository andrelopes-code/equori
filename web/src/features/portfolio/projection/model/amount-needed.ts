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

// PX5, PX14: the value at the withdrawal age that sustains the income over `months` at the monthly
// `rate`. Without a tax it is the present value of the income; with one, the smallest value that
// lasts, between that and the one that pays the whole tax.
export function amountNeeded(
  income: number,
  months: number,
  rate: number,
  tax?: NeededTax,
): number {
  const net =
    rate === 0
      ? income * months
      : (income * (1 - (1 + rate) ** -months)) / rate;
  if (tax === undefined) return net;

  let low = net;
  let high = net / (1 - tax.rate);
  for (let i = 0; i < halvings; i++) {
    const middle = (low + high) / 2;
    if (lasts(middle, income, months, rate, tax)) high = middle;
    else low = middle;
  }

  return high;
}

function lasts(
  start: number,
  income: number,
  months: number,
  rate: number,
  tax: NeededTax,
): boolean {
  let value = start;
  let basis = start * tax.basisShare;

  for (let i = 0; i < months; i++) {
    value *= 1 + rate;
    basis /= 1 + tax.inflation;
    const gross = grossOf(income, gainShare(value, basis), tax.rate);
    if (gross > value) return false;

    basis *= 1 - gross / value;
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
