import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { ForecastPoint } from "@/features/forecast";
import type { ForecastMove } from "@/features/reports/forecast-day-moves";
import { NetWorthTooltipRow } from "@/features/reports/net-worth-tooltip-row";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

import styles from "@/features/reports/net-worth-forecast-tooltip.module.css";

export interface NetWorthForecastTooltipProps {
  point: ForecastPoint;
  moves: readonly ForecastMove[];
  currency: string;
  digits: number;
}

// The tooltip of today and of each remaining day: the forecast and its likely range, then each
// amount that moves the day, signed (net worth forecast design, F9). Today states its net worth.
export function NetWorthForecastTooltip({
  point,
  moves,
  currency,
  digits,
}: NetWorthForecastTooltipProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();

  const money = (amount: number) =>
    fmt.money({ amount: Math.round(amount), currency }, digits);
  // The ends of an estimate in whole units: their cents are noise.
  const whole = (amount: number) =>
    fmt.money({ amount: Math.round(amount / 10 ** digits), currency }, 0);
  const signed = (amount: number) =>
    fmt.signed({ amount: Math.round(amount), currency }, digits);
  const moved = moves.length > 0 || point.variable !== 0;
  const ranged =
    point.low !== undefined &&
    point.high !== undefined &&
    point.low !== point.high;

  return (
    <Stack gap={3} className={styles.tooltip}>
      <Text size="sm" weight="semibold">
        {formatDayMonth(point.date, tag)}
      </Text>

      <Stack gap={1}>
        <NetWorthTooltipRow
          label={t(
            point.date === today
              ? "report.netWorth.net"
              : "report.netWorth.forecast",
          )}
          value={money(point.value)}
          strong
        />
        {ranged && (
          <NetWorthTooltipRow
            label={t("report.netWorth.range")}
            value={t("report.netWorth.rangeValue", {
              low: whole(point.low ?? point.value),
              high: whole(point.high ?? point.value),
            })}
          />
        )}
      </Stack>

      {moved && (
        <Stack gap={1}>
          <Text size="sm" weight="semibold">
            {t("report.netWorth.forecastMoves")}
          </Text>
          {moves.map((move, i) => (
            <NetWorthTooltipRow
              key={`${move.description}-${String(i)}`}
              label={move.description}
              value={signed(move.amount)}
            />
          ))}
          {point.variable !== 0 && (
            <NetWorthTooltipRow
              label={t("report.netWorth.forecastVariable")}
              value={signed(point.variable)}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}
