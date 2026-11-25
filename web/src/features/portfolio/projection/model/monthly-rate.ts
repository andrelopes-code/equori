// PX4: the monthly rate that compounds to an annual rate given in basis points.
export function monthlyRate(annualBp: number): number {
  return (1 + annualBp / 10000) ** (1 / 12) - 1;
}
