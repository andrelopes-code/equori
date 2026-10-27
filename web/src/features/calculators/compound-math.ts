import { roundHalfEven } from "@/features/calculators/round";

// Amounts are minor units; j is a monthly rate as a fraction; n a number of months.

// M1: Sₙ = q₀ (1 + j)ⁿ.
export function futureValue(q0: number, j: number, n: number): number {
  return roundHalfEven(q0 * (1 + j) ** n);
}

// The factor of M2: what one unit deposited at the start of each of n months reaches.
function depositsFactor(j: number, n: number): number {
  return j === 0 ? n : ((1 + j) * ((1 + j) ** n - 1)) / j;
}

// M2: Sₙ = (1 + j) · ((1 + j)ⁿ − 1) / j · p, deposits at the start of each month (BCB).
export function depositsValue(p: number, j: number, n: number): number {
  return roundHalfEven(depositsFactor(j, n) * p);
}

// The monthly deposit that, beside q0, reaches target in n months; 0 when q0 alone reaches it,
// null without a month.
export function depositForTarget(
  target: number,
  q0: number,
  j: number,
  n: number,
): number | null {
  if (n <= 0) return null;
  const missing = target - q0 * (1 + j) ** n;
  return missing <= 0 ? 0 : roundHalfEven(missing / depositsFactor(j, n));
}

// The balance at the end of each month: the deposit enters at the start of the month, then the
// month's interest; the balance is rounded every month. deposited counts q0 and the deposits.
export function balances(
  q0: number,
  p: number,
  j: number,
  n: number,
): { month: number; balance: number; deposited: number }[] {
  const out: { month: number; balance: number; deposited: number }[] = [];
  let balance = q0;
  for (let month = 1; month <= n; month++) {
    balance = roundHalfEven((balance + p) * (1 + j));
    out.push({ month, balance, deposited: q0 + p * month });
  }
  return out;
}

// The monthly income a balance pays at the monthly rate j, withdrawn at the end of each month and
// raised each month with inflation g, in money of the balance's date. Without a term it keeps
// the balance's purchasing power: W = F × (j − g), and none exists when g ≥ j. Over a term of n
// months it spends the balance: W = F × (j − g) / (1 − ((1 + g) / (1 + j))^n), or
// F × (1 + j) / n when j = g. Minor units, rounded half to even.
export function monthlyIncome(
  balance: number,
  j: number,
  g: number,
  months?: number,
): number | null {
  if (months === undefined)
    return j > g ? roundHalfEven(balance * (j - g)) : null;
  if (j === g) return roundHalfEven((balance * (1 + j)) / months);
  return roundHalfEven(
    (balance * (j - g)) / (1 - ((1 + g) / (1 + j)) ** months),
  );
}
