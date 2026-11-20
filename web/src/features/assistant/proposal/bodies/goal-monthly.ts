// What each month must put in for a goal: the target over the whole months from this month to the
// due month, rounded up in minor units so the months reach it (answer views design, goal body).
export function goalMonthly(
  target: number,
  today: string,
  due: string,
): { months: number; monthly: number } {
  const month = (iso: string) =>
    Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
  const months = Math.max(month(due) - month(today), 0);

  return { months, monthly: months > 0 ? Math.ceil(target / months) : target };
}
