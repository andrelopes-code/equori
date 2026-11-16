// The API names the days in this order; the reference dates below start on a Sunday.
const weekdayOrder = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const sunday = Date.UTC(2023, 0, 1);
const dayMs = 86_400_000;

// The weekend days of a calendar, named by the locale: "Saturday and Sunday".
export function weekendNames(tag: string): (days: readonly string[]) => string {
  const day = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    timeZone: "UTC",
  });
  const list = new Intl.ListFormat(tag, { type: "conjunction" });

  return (days) =>
    list.format(
      days.map((d) =>
        day.format(new Date(sunday + weekdayOrder.indexOf(d) * dayMs)),
      ),
    );
}
