// The span of years a maturity bound offers: a security on sale matures within it.
const span = 40;

// The years a maturity bound offers from today, plus the years the rule already holds, in order.
export function maturityYears(
  today: string,
  chosen: readonly (number | null)[],
): number[] {
  const first = Number(today.slice(0, 4));
  const years = new Set(Array.from({ length: span + 1 }, (_, i) => first + i));

  for (const year of chosen) if (year !== null) years.add(year);

  return [...years].sort((a, b) => a - b);
}
