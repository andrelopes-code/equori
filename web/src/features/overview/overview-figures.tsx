import styles from "@/features/overview/overview-page.module.css";
import type { Overview } from "@/features/overview/use-overview";
import { formatDayMonth, formatMonthName, formatSigned } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureStrip } from "@/ui/figure-strip";
import { FigureStripItem } from "@/ui/figure-strip-item";
import { MoneyFigure } from "@/ui/money-figure";
import { MoneyText } from "@/ui/money-text";
import { useViewport } from "@/ui/use-viewport";

// Complete frontend O3: today, the forecast in the accent tone, the lowest point and the month's flows.
export function OverviewFigures({
  overview,
  scale,
}: {
  overview: Overview;
  scale: (currency: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const viewport = useViewport();
  const size = viewport === "desktop" ? "xl" : "lg";
  const s = scale(overview.base);
  const money = (amount: number) => ({ amount, currency: overview.base });
  const end = overview.days.at(-1)?.date ?? `${overview.month}-01`;
  const flows = (
    <span className={styles.flows}>
      {(
        [
          ["overview.income", overview.flows.income],
          ["overview.spending", overview.flows.spending],
          ["overview.moved", overview.flows.moved],
        ] as const
      ).map(([key, amount]) => (
        <span key={key} className={styles.flow}>
          <span className={styles.muted}>{t(key)}</span>
          <MoneyText money={money(amount)} scale={s} />
        </span>
      ))}
    </span>
  );
  const monthName = formatMonthName(overview.month, locale);
  if (!overview.current) {
    return (
      <FigureStrip label={t("home.balances")} ruled={false}>
        <FigureStripItem label={t("overview.closing")}>
          <MoneyFigure money={money(overview.closing)} scale={s} size={size} />
        </FigureStripItem>
        <FigureStripItem label={t("overview.opening")}>
          <MoneyFigure money={money(overview.opening)} scale={s} size={size} />
        </FigureStripItem>
        <FigureStripItem
          label={t("overview.lowest.past")}
          caption={
            overview.lowestRealized === null
              ? undefined
              : t("overview.lowest.on", {
                  date: formatDayMonth(overview.lowestRealized.date, locale),
                })
          }
        >
          <MoneyFigure
            money={money(overview.lowestRealized?.balance ?? 0)}
            scale={s}
            size={size}
          />
        </FigureStripItem>
        <FigureStripItem label={t("overview.flows.past", { month: monthName })}>
          {flows}
        </FigureStripItem>
      </FigureStrip>
    );
  }
  const lowest = overview.lowest;
  return (
    <FigureStrip label={t("home.balances")} ruled={false}>
      <FigureStripItem label={t("overview.today")}>
        <MoneyFigure money={money(overview.today)} scale={s} size={size} />
      </FigureStripItem>
      <FigureStripItem
        label={t("overview.forecast", { date: formatDayMonth(end, locale) })}
        caption={t("overview.forecast.delta", {
          delta: formatSigned(
            money(overview.closing - overview.today),
            s,
            locale,
          ),
        })}
      >
        <MoneyFigure
          money={money(overview.closing)}
          scale={s}
          size={size}
          tone="accent"
        />
      </FigureStripItem>
      <FigureStripItem
        label={t("overview.lowest")}
        caption={
          lowest === null
            ? undefined
            : lowest.event === undefined
              ? t("overview.lowest.on", {
                  date: formatDayMonth(lowest.date, locale),
                })
              : t("overview.lowest.after", {
                  date: formatDayMonth(lowest.date, locale),
                  event: lowest.event.description,
                })
        }
      >
        <MoneyFigure
          money={money(lowest?.balance ?? overview.today)}
          scale={s}
          size={size}
        />
      </FigureStripItem>
      <FigureStripItem label={t("overview.flows", { month: monthName })}>
        {flows}
      </FigureStripItem>
    </FigureStrip>
  );
}
