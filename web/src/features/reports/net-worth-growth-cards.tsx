import { Grid } from "@slotted/react/grid";

import type { ReportPeriod } from "@/features/reports/report-period";
import { useNetWorthGrowth } from "@/features/reports/use-net-worth-growth";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";

export interface NetWorthGrowthCardsProps {
  period: ReportPeriod;
  // The date of the last point of the series; undefined for a period after today.
  closing: string | undefined;
  valueIn: string;
  digits: number;
}

// How much the net worth grew over the period, and how much of it income minus expenses explain.
export function NetWorthGrowthCards({
  period,
  closing,
  valueIn,
  digits,
}: NetWorthGrowthCardsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { growth, pending, base } = useNetWorthGrowth(period, closing, valueIn);

  const amount = (value: number | undefined) =>
    value === undefined
      ? undefined
      : {
          money: { amount: value, currency: valueIn },
          scale: digits,
          signed: true,
        };
  const span = t("report.netWorth.changeNote", {
    start: formatDate(shiftDate(period.from, -1), tag),
    end: formatDate(closing ?? period.to, tag),
  });
  const partsNote =
    base !== undefined && base !== valueIn
      ? t("report.netWorth.partsBase", { currency: base })
      : undefined;

  return (
    <Grid columns={3} gap={4} minItemWidth="sm">
      <FigureCard
        label={t("report.netWorth.change")}
        value={amount(growth?.change)}
        delta={
          growth?.changeBP === undefined ? undefined : growth.changeBP / 10000
        }
        note={span}
        loading={pending}
      />
      <FigureCard
        label={t("report.netWorth.resultOfPeriod")}
        value={amount(growth?.result)}
        note={partsNote ?? t("report.netWorth.resultNote")}
        goodWhen="none"
        loading={pending}
      />
      <FigureCard
        label={t("report.netWorth.other")}
        value={amount(growth?.other)}
        note={partsNote ?? t("report.netWorth.otherNote")}
        goodWhen="none"
        loading={pending}
      />
    </Grid>
  );
}
