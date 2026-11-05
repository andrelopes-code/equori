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
// routine amounts, signed (net worth forecast design, F9).
export function NetWorthForecastLines({
  point,
  currency,
  digits,
}: NetWorthForecastLinesProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  if (point === undefined) return null;

  const signed = (amount: number) => fmt.signed({ amount, currency }, digits);

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
    </Stack>
  );
}
