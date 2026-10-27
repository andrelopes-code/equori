import { roundHalfEven } from "@/features/calculators/round";
import { bisect } from "@/features/calculators/solve";

// Amounts are minor units; j is a monthly rate as a fraction.

// The k of each installment: 1 to count from one month after the purchase, 0 to count − 1 when
// the first is due at once.
function periods(count: number, firstNow: boolean): number[] {
  return Array.from({ length: count }, (_, i) => (firstNow ? i : i + 1));
}

function exactPresentValue(
  count: number,
  installment: number,
  j: number,
  firstNow: boolean,
): number {
  return periods(count, firstNow).reduce(
    (s, k) => s + installment / (1 + j) ** k,
    0,
  );
}

// Σ p / (1 + j)^k: what the installments are worth today at the rate j.
export function presentValue(
  count: number,
  installment: number,
  j: number,
  firstNow: boolean,
): number {
  return roundHalfEven(exactPresentValue(count, installment, j, firstNow));
}

// The monthly rate j for which cash = Σ p / (1 + j)^k (study §3.2 applied to a cash price).
// Installments totalling the cash price or less carry no interest; null when no rate up to
// 100% a month answers.
export function impliedRate(
  cash: number,
  count: number,
  installment: number,
  firstNow: boolean,
): number | "no_interest" | null {
  if (count * installment <= cash) return "no_interest";
  return bisect(
    (j) => exactPresentValue(count, installment, j, firstNow),
    0,
    1,
    cash,
  );
}

// Monthly due dates from the first (vision T02): a day the month lacks becomes its last day.
export function monthlyDates(first: string, count: number): string[] {
  const [year = 0, month = 1, day = 1] = first.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const last = new Date(Date.UTC(year, month + i, 0)).getUTCDate();
    return new Date(Date.UTC(year, month - 1 + i, Math.min(day, last)))
      .toISOString()
      .slice(0, 10);
  });
}

const msPerDay = 86_400_000;

function days(from: string, to: string): number {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / msPerDay
  );
}

// CMN 4.881, art. 4: FC₀ = Σ FCⱼ / (1 + CET)^((dⱼ − d₀) / 365), FC₀ the amount released less
// the fees paid upfront. Null when no cost from −99% to 10,000% a year answers.
export function effectiveAnnualCost(
  released: number,
  fees: number,
  releaseDate: string,
  flows: readonly { date: string; amount: number }[],
): number | null {
  const net = released - fees;
  if (net <= 0 || flows.length === 0) return null;
  const terms = flows.map((f) => ({
    amount: f.amount,
    years: days(releaseDate, f.date) / 365,
  }));
  return bisect(
    (c) => terms.reduce((s, f) => s + f.amount / (1 + c) ** f.years, 0),
    -0.99,
    100,
    net,
  );
}
