// M5: an annual rate is (1 + monthly)^12 − 1.
export function monthlyToAnnual(j: number): number {
  return (1 + j) ** 12 - 1;
}

export function annualToMonthly(r: number): number {
  return (1 + r) ** (1 / 12) - 1;
}

// M6: the rate left after inflation.
export function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}
