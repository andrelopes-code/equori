import type { IndicatorMonth, Indicators } from "@/features/overview";

// The savings rate of months 3 to 11 of indicatorReport.
export const savings = [1000, -500, 2000, 0, 1500, 500, 2500, 1000, 800];

export interface ReportOptions {
  // Index of the first month with amounts; the months before it hold zeros.
  active?: number;
  last?: Partial<IndicatorMonth>;
}

export function indicatorReport({
  active = 3,
  last = {},
}: ReportOptions = {}): Indicators {
  const months = Array.from({ length: 12 }, (_, i) =>
    i < active ? idleMonth(i) : activeMonth(i),
  );

  return {
    currency: "BRL",
    months: months.map((m, i) => (i === 11 ? { ...m, ...last } : m)),
  };
}

function idleMonth(index: number): IndicatorMonth {
  return {
    month: monthName(index),
    income: brl(0),
    expense: brl(0),
    committed: brl(0),
    debt_service: brl(0),
    liquid_balance: brl(0),
    liabilities: brl(0),
    savings_rate: { bp: 0 },
    trailing_savings_rate: { bp: 0 },
    liquidity: { bp: 0 },
    committed_share: { bp: 0 },
    debt_service_share: { bp: 0 },
  };
}

function activeMonth(index: number): IndicatorMonth {
  return {
    ...idleMonth(index),
    income: brl(100000),
    expense: brl(80000),
    liquid_balance: brl(500000),
    savings_rate: { bp: savings[index - 3] ?? 800 },
    trailing_savings_rate: index === 11 ? { bp: 1200 } : { bp: 900 },
    liquidity: { bp: 30000 + 100 * index },
    committed_share: { bp: index === 11 ? 1744 : 0 },
  };
}

function monthName(index: number): string {
  const month = ((10 + index) % 12) + 1;
  const year = 2025 + Math.floor((10 + index) / 12);

  return `${String(year)}-${String(month).padStart(2, "0")}`;
}

export function brl(amount: number) {
  return { amount, currency: "BRL" };
}
