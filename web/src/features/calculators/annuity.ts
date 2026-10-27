import { roundHalfEven } from "@/features/calculators/round";
import { bisect } from "@/features/calculators/solve";

// Amounts are minor units; j is a monthly rate as a fraction; n a number of months.

export interface AmortizationRow {
  month: number;
  installment: number;
  interest: number;
  amortization: number;
  balance: number;
}

const maxMonths = 1200;

// M3 solved for p: q₀ = (1 − (1 + j)⁻ⁿ) / j · p, unrounded.
function exactInstallment(q0: number, j: number, n: number): number {
  return j === 0 ? q0 / n : (q0 * j) / (1 - (1 + j) ** -n);
}

// The fixed installment of a Price loan, rounded once (design §5, financing).
export function priceInstallment(q0: number, j: number, n: number): number {
  return roundHalfEven(exactInstallment(q0, j, n));
}

// Each month's interest is rounded; the last installment closes the balance.
function schedule(
  q0: number,
  j: number,
  n: number,
  amortizationOf: (interest: number) => number,
): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let balance = q0;
  for (let month = 1; month <= n; month++) {
    const interest = roundHalfEven(balance * j);
    const amortization = month === n ? balance : amortizationOf(interest);
    balance -= amortization;
    rows.push({
      month,
      installment: amortization + interest,
      interest,
      amortization,
      balance,
    });
  }
  return rows;
}

export function priceSchedule(
  q0: number,
  j: number,
  n: number,
): AmortizationRow[] {
  const p = priceInstallment(q0, j, n);
  return schedule(q0, j, n, (interest) => p - interest);
}

// M4: a constant amortization, rounded once.
export function sacSchedule(
  q0: number,
  j: number,
  n: number,
): AmortizationRow[] {
  const a = roundHalfEven(q0 / n);
  return schedule(q0, j, n, () => a);
}

// Any of amount, rate, months and installment of a Price loan from the other three; null when
// no value answers (an installment that does not cover the interest, a rate out of range).
export function solvePrice(input: {
  amount?: number | undefined;
  rate?: number | undefined;
  months?: number | undefined;
  installment?: number | undefined;
}): {
  amount: number;
  rate: number;
  months: number;
  installment: number;
} | null {
  const { amount, rate, months, installment } = input;
  if (amount !== undefined && rate !== undefined && months !== undefined)
    return {
      amount,
      rate,
      months,
      installment: priceInstallment(amount, rate, months),
    };
  if (rate !== undefined && months !== undefined && installment !== undefined) {
    const factor = rate === 0 ? months : (1 - (1 + rate) ** -months) / rate;
    return {
      amount: roundHalfEven(installment * factor),
      rate,
      months,
      installment,
    };
  }
  if (amount !== undefined && rate !== undefined && installment !== undefined) {
    if (installment <= roundHalfEven(amount * rate)) return null;
    for (let n = 1; n <= maxMonths; n++)
      if (priceInstallment(amount, rate, n) <= installment)
        return { amount, rate, months: n, installment };
    return null;
  }
  if (
    amount !== undefined &&
    months !== undefined &&
    installment !== undefined
  ) {
    // A monthly rate between 0 and 100%.
    const j = bisect(
      (x) => exactInstallment(amount, x, months),
      0,
      1,
      installment,
    );
    return j === null ? null : { amount, rate: j, months, installment };
  }
  return null;
}

// A prepayment of extra right after installment `month`: the balance left, then the months and
// interest when the installment is kept, the installment and interest when the term is kept,
// and the interest the original schedule would still charge. Null for a month outside 1 to n − 1.
export function prepay(
  q0: number,
  j: number,
  n: number,
  month: number,
  extra: number,
): {
  balance: number;
  keepInstallment: { months: number; interest: number; last: number };
  keepTerm: { installment: number; interest: number };
  without: { interest: number };
} | null {
  if (month < 1 || month >= n) return null;
  const rows = priceSchedule(q0, j, n);
  const p = priceInstallment(q0, j, n);
  const without = rows.slice(month).reduce((s, r) => s + r.interest, 0);
  const balance = Math.max((rows[month - 1]?.balance ?? 0) - extra, 0);
  let left = balance;
  let months = 0;
  let interest = 0;
  let last = 0;
  while (left > 0 && months < maxMonths) {
    const i = roundHalfEven(left * j);
    months++;
    interest += i;
    if (left + i <= p) {
      last = left + i;
      left = 0;
    } else left = left + i - p;
  }
  const term = balance === 0 ? [] : priceSchedule(balance, j, n - month);
  return {
    balance,
    keepInstallment: { months, interest, last },
    keepTerm: {
      installment: term[0]?.installment ?? 0,
      interest: term.reduce((s, r) => s + r.interest, 0),
    },
    without: { interest: without },
  };
}
