export function purchaseInterest(
  count: number,
  installment: number,
  total: number,
): number {
  return count * installment - total;
}

export function financingInterest(
  count: number,
  installment: number,
  unpaid: number,
): number {
  return count * installment - unpaid;
}

export function anticipation(
  amounts: number[],
  paid: number,
): { sum: number; discount: number } {
  const sum = amounts.reduce((total, amount) => total + amount, 0);
  return { sum, discount: sum - paid };
}

export function usedShare(debt: number, limit: number | undefined): number {
  if (limit === undefined || limit <= 0 || debt <= 0) return 0;
  return Math.min(100, Math.round((debt * 100) / limit));
}
