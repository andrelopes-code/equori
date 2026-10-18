import type { components } from "@/api/schema.gen";
import { formatPlain } from "@/i18n/format";

type BalanceSeries = components["schemas"]["BalanceSeries"];

const windowDays = 90;
const dayMs = 24 * 60 * 60 * 1000;

// `from` is today minus 89 days, so the window holds 90 daily points, today included.
export function ninetyDayWindow(today: string): { from: string; to: string } {
  const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, day) - (windowDays - 1) * dayMs,
  );
  return { from: start.toISOString().slice(0, 10), to: today };
}

// The chart plots numbers; the minor-unit amount goes through formatPlain, never a division by a power of ten.
export function toChartPoints(
  series: BalanceSeries,
  scale: number,
): { date: string; value: number }[] {
  return series.items.map((point) => ({
    date: point.date,
    value: Number(formatPlain(point.balance.amount, scale)),
  }));
}
