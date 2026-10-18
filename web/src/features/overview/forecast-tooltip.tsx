import type { ForecastDay } from "@/features/overview/forecast";
import styles from "@/features/overview/overview-page.module.css";
import { formatDayHeader, formatSigned } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";

const separator = " · ";

// Complete frontend O4: the day, whether it is forecast, the balance and what moves it.
export function ForecastTooltip({
  day,
  today,
  currency,
  scale,
}: {
  day: ForecastDay;
  today: string;
  currency: string;
  scale: number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const balance = day.forecast ?? day.realized ?? 0;
  const net = day.events.reduce((sum, event) => sum + event.amount, 0);
  const when =
    day.date === today
      ? t("overview.tooltip.today")
      : day.date > today
        ? t("overview.tooltip.forecast")
        : undefined;
  return (
    <span className={styles.tooltip}>
      <span className={styles.muted}>
        {formatDayHeader(day.date, "", locale, { today: "", yesterday: "" })}
        {when !== undefined && separator + when}
      </span>
      <span className={styles.tooltipBalance}>
        <MoneyText money={{ amount: balance, currency }} scale={scale} />
      </span>
      <span className={styles.muted}>
        {day.events.length === 0
          ? t("overview.tooltip.none")
          : `${day.events.map((event) => event.description).join(", ")}${separator}${formatSigned({ amount: net, currency }, scale, locale, { symbol: false })}`}
      </span>
    </span>
  );
}
