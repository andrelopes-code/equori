import { Text } from "@slotted/react/typography";

import { catalogLabel } from "@/features/setup";
import type { ReferenceRate } from "@/features/instruments/fund-report/break-even";
import type { FundFigures } from "@/features/instruments/fund-report/fund-figures";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface BreakEvenLineProps {
  figures: FundFigures;
  reference: ReferenceRate | null;
  growth: number | null;
  otherCurrency: boolean;
}

// FR10, FR11: the growth of the distributions at which the fund pays what the longest real bond
// pays. A missing figure is written in words.
export function BreakEvenLine({
  figures,
  reference,
  growth,
  otherCurrency,
}: BreakEvenLineProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (reference === null) {
    return <Text size="sm">{t("fundReport.noCurve")}</Text>;
  }

  if (growth === null) {
    const gap = figures.yearDistribution === null ? "fewReports" : "noPrice";

    return (
      <Text size="sm">
        {otherCurrency ? t("fundReport.otherCurrency") : t(`fundReport.${gap}`)}
      </Text>
    );
  }

  const percent = (value: number, signed: boolean) =>
    numberFormatter(locale, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...(signed ? { signDisplay: "exceptZero" as const } : {}),
    }).format(value);

  return (
    <Text size="sm">
      {t("fundReport.breakEven", {
        curve: catalogLabel(
          t,
          `fundReport.curve.${reference.curve}`,
          reference.curve,
        ),
        year: reference.maturity.slice(0, 4),
        rate: percent(reference.rate, false),
        date: formatDate(reference.baseDate, locale),
        growth: percent(growth, true),
      })}
    </Text>
  );
}
