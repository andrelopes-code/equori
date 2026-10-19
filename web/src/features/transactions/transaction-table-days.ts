interface Dated {
  date: string;
  money: { amount: number; currency: string };
}

export interface Day<T> {
  date: string;
  items: T[];
  // Sum of the counted items in the base currency; undefined when none counts.
  net: number | undefined;
}

// Consecutive items of one date form a day, so a next page that continues a day joins it.
export function groupByDay<T extends Dated>(
  items: readonly T[],
  base: string | undefined,
  counts: (item: T) => boolean = () => true,
): Day<T>[] {
  const days: Day<T>[] = [];
  for (const item of items) {
    let day = days[days.length - 1];
    if (day?.date !== item.date) {
      day = { date: item.date, items: [], net: undefined };
      days.push(day);
    }
    day.items.push(item);
    if (item.money.currency === base && counts(item)) {
      day.net = (day.net ?? 0) + item.money.amount;
    }
  }
  return days;
}
