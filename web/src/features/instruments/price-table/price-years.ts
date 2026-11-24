// The calendar years from the last quote back to the first.
export function priceYears(first: string, last: string): number[] {
  const newest = yearOf(last);

  return Array.from(
    { length: newest - yearOf(first) + 1 },
    (_, back) => newest - back,
  );
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}
