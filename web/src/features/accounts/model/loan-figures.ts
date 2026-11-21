import type { components } from "@/api/schema.gen";

type Schedule = components["schemas"]["Schedule"];
type Transaction = components["schemas"]["Transaction"];

export interface LoanFigures {
  financed: number;
  outstanding: number;
  repaid: number;
  // repaid / financed; undefined when nothing was financed.
  fraction: number | undefined;
  interest: number;
  // The transactions that repaid principal.
  payments: number;
}

export interface RemainingInstallments {
  count: number;
  last: string;
  amount: components["schemas"]["Money"];
}

// A schedule of 100 years of monthly installments ends the walk.
const maxSteps = 1200;

// K5 and K6: what the loan lent, what it still owes, and the interest its payments carried.
export function loanFigures(
  loanId: string,
  balance: number,
  transactions: readonly Transaction[],
  interestIds: ReadonlySet<string>,
): LoanFigures {
  let financed = 0;
  let interest = 0;
  let payments = 0;

  for (const tx of transactions) {
    let repays = false;

    for (const p of tx.postings) {
      if (p.account_id !== loanId) continue;

      if (p.amount.amount < 0) financed -= p.amount.amount;
      if (p.amount.amount > 0) repays = true;
    }

    if (!repays) continue;

    payments += 1;
    for (const p of tx.postings) {
      if (interestIds.has(p.account_id)) interest += p.amount.amount;
    }
  }

  const outstanding = -balance;
  const repaid = financed - outstanding;

  return {
    financed,
    outstanding,
    repaid,
    fraction: financed === 0 ? undefined : repaid / financed,
    interest,
    payments,
  };
}

// K7: the installments of the loan's schedule after today, for a monthly recurrence with an end.
export function remainingInstallments(
  loanId: string,
  schedules: readonly Schedule[],
  today: string,
): RemainingInstallments | undefined {
  const schedule = schedules.find(
    (s) => s.counterpart_id === loanId && s.ends_on !== undefined,
  );
  if (schedule?.ends_on === undefined) return undefined;

  const term = schedule.terms.reduce((a, b) =>
    b.effective_from > a.effective_from ? b : a,
  );
  const rec = term.recurrence;
  if (rec.frequency !== "monthly") return undefined;

  const year = Number(rec.start.slice(0, 4));
  const month = Number(rec.start.slice(5, 7));
  const day = rec.day_of_month ?? Number(rec.start.slice(8, 10));
  let count = 0;
  let last = "";

  for (let k = 0; k < maxSteps; k++) {
    const date = monthDate(year, month - 1 + k * rec.interval, day);
    if (date >= schedule.ends_on) break;

    if (date > today && date >= term.effective_from) {
      count += 1;
      last = date;
    }
  }

  return count === 0 ? undefined : { count, last, amount: term.amount };
}

// The day of a month, held to the month's last day (the 31st of February is the 28th or 29th).
function monthDate(year: number, monthIndex: number, day: number): string {
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = Math.min(day, lastDay);

  return [
    String(y).padStart(4, "0"),
    String(m + 1).padStart(2, "0"),
    String(d).padStart(2, "0"),
  ].join("-");
}
