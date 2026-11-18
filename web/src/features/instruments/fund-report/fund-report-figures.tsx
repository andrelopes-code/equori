import type { FundFigures } from "@/features/instruments/fund-report/fund-figures";
import { useScale } from "@/features/setup";
import { numberFormatter } from "@/i18n/format";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";
import type { MoneyAmount } from "@/ui/money/money-value";

interface FundReportFiguresProps {
  figures: FundFigures;
  currency: string;
  // The date of the price the price figures read; null without one.
  priceDate: string | null;
  otherCurrency: boolean;
}

// The eight figures of FR7 to FR9. A null figure is written in words, never as zero. The values
// are public data: privacy mode leaves them visible.
export function FundReportFigures({
  figures,
  currency,
  priceDate,
  otherCurrency,
}: FundReportFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scaleOf = useScale();

  if (scaleOf === null) return null;

  const scale = scaleOf(currency);
  const factor = 10 ** scale;
  const money = (minor: number | null, words: string) => {
    if (minor === null) return words;
    if (!fmt.hidden)
      return {
        money: { amount: minor, currency },
        scale,
      } satisfies MoneyAmount;

    return numberFormatter(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: scale,
      maximumFractionDigits: scale,
    }).format(minor / factor);
  };
  const units = (value: number | null) =>
    value === null ? null : Math.round(value * factor);
  const percent = (value: number | null, words: string, max = 2) =>
    value === null
      ? words
      : numberFormatter(locale, {
          style: "percent",
          minimumFractionDigits: 2,
          maximumFractionDigits: max,
        }).format(value);

  const notInformed = t("fundReport.notInformed");
  const fewReports = t("fundReport.fewReports");
  const noPrice = otherCurrency
    ? t("fundReport.otherCurrency")
    : t("fundReport.noPrice");
  const priceNote =
    priceDate === null
      ? ""
      : t("fundReport.note.price", { date: formatDate(priceDate, locale) });
  const priceToBook =
    figures.priceToBook === null
      ? noPrice
      : numberFormatter(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(figures.priceToBook);
  const holders =
    figures.holders === null
      ? notInformed
      : numberFormatter(locale, { maximumFractionDigits: 0 }).format(
          figures.holders,
        );
  const yearGap = figures.yearDistribution === null ? fewReports : noPrice;

  return (
    <FigureGrid label={t("fundReport.title")}>
      <FigureCard
        label={t("fundReport.unitBookValue")}
        value={money(units(figures.unitBookValue), notInformed)}
        note={t("fundReport.note.unitBookValue")}
        goodWhen="none"
      />

      <FigureCard
        label={t("fundReport.priceToBook")}
        value={priceToBook}
        note={priceNote}
        goodWhen="none"
      />

      <FigureCard
        label={t("fundReport.netAssets")}
        value={money(figures.netAssets, notInformed)}
        note={t("fundReport.note.netAssets")}
        goodWhen="none"
      />

      <FigureCard
        label={t("fundReport.holders")}
        value={holders}
        note={t("fundReport.note.holders")}
        goodWhen="none"
      />

      <FigureCard
        label={t("fundReport.adminFee")}
        value={percent(figures.adminFee, notInformed, 4)}
        note={t("fundReport.note.adminFee")}
        goodWhen="none"
      />

      <FigureCard
        label={t("fundReport.monthYield")}
        value={percent(figures.monthYield, notInformed)}
        note={t("fundReport.note.monthYield")}
        goodWhen="none"
      />

      <FigureCard
        label={t("fundReport.yearDistribution")}
        value={money(units(figures.yearDistribution), fewReports)}
        note={t("fundReport.note.yearDistribution")}
        goodWhen="none"
      />

      <FigureCard
        label={t("fundReport.yearYield")}
        value={percent(figures.yearYield, yearGap)}
        note={priceNote}
        goodWhen="none"
      />
    </FigureGrid>
  );
}
