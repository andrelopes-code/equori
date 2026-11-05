import { quantile } from "@/features/forecast/quantile";

const minAmounts = 8;
const fenceFactor = 1.5;

// Whether an amount lies above Tukey's upper fence on the logarithms of the amounts, which
// spending makes close to log-normal; nothing is atypical below eight amounts (net worth forecast
// design, F6). The comparison stays in log space: exp(log(x)) can land below x.
export function atypicalFence(
  amounts: readonly number[],
): (amount: number) => boolean {
  if (amounts.length < minAmounts) return () => false;

  const logs = amounts.map((amount) => Math.log(amount));
  const q1 = quantile(logs, 0.25);
  const q3 = quantile(logs, 0.75);
  const fence = q3 + fenceFactor * (q3 - q1);

  return (amount) => amount > 0 && Math.log(amount) > fence;
}
