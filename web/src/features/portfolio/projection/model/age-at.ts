// The whole years from a birth date to a date, both `YYYY-MM-DD`.
export function ageAt(birthDate: string, date: string): number {
  const [by = 0, bm = 0, bd = 0] = birthDate.split("-").map(Number);
  const [y = 0, m = 0, d = 0] = date.split("-").map(Number);
  const birthdayPassed = m > bm || (m === bm && d >= bd);

  return y - by - (birthdayPassed ? 0 : 1);
}
