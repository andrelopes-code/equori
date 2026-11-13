interface PricePoint {
  date: string;
  value: string;
}

// The values of the prices, oldest first.
export function priceValues(points: readonly PricePoint[]): number[] {
  return [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => Number(point.value));
}
