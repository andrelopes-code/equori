import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { ForecastPoint } from "@/features/forecast";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface NetWorthForecastLinesProps {
  point: ForecastPoint | undefined;
  currency: string;
  digits: number;
}

// What moves a forecast day, under the chart's own tooltip rows: its scheduled, recurring and
// routine amounts, signed, and the likely range when the forecast states one (net worth forecast design,
// F9).
// Workaround for Slotted issue #72: the likely range is written here because no chart series
// draws a band around a line.
export function NetWorthForecastLines({
  point,
  currency,
  digits,
}: NetWorthForecastLinesProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  if (point === undefined) return null;

  const signed = (amount: number) => fmt.signed({ amount, currency }, digits);
  const money = (amount: number) => fmt.money({ amount, currency }, digits);

  return (
    <Stack gap={1}>
      {point.scheduled !== 0 && (
        <Text size="sm">
          {t("report.netWorth.forecastScheduled", {
            amount: signed(point.scheduled),
          })}
        </Text>
      )}
      {point.recurring !== 0 && (
        <Text size="sm">
          {t("report.netWorth.forecastRecurring", {
            amount: signed(point.recurring),
          })}
        </Text>
      )}
      {point.variable !== 0 && (
        <Text size="sm">
          {t("report.netWorth.forecastVariable", {
            amount: signed(point.variable),
          })}
        </Text>
      )}
      {point.low !== undefined && point.high !== undefined && (
        <Text size="sm" tone="muted">
          {t("report.netWorth.forecastRange", {
            low: money(point.low),
            high: money(point.high),
          })}
        </Text>
      )}
    </Stack>
  );
}
