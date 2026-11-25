// PX5: the present value, at the withdrawal age, of the income over `months` at the monthly `rate`.
export function amountNeeded(
  income: number,
  months: number,
  rate: number,
): number {
  if (rate === 0) return income * months;

  return (income * (1 - (1 + rate) ** -months)) / rate;
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
