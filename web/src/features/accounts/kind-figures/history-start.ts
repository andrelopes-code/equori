import { shiftDate } from "@/i18n/format";

// /reports/balances answers at most 3660 days, today included.
const maxDays = 3660;

// K8: the first day of a property's or a loan's history, its opening date held to the window the
// balance report answers.
export function historyStart(
  openedOn: string | undefined,
  today: string,
): string {
  const earliest = shiftDate(today, -(maxDays - 1));

  return openedOn !== undefined && openedOn > earliest ? openedOn : earliest;
}
