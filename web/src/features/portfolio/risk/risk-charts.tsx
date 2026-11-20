import type { ChartRecord, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Grid } from "@slotted/react/grid";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { classLabel } from "@/features/portfolio/risk/class-label";
import {
  deepestFall,
  drawdownRows,
  portfolioKey,
  seriesWithValue,
  volatilityKeys,
  volatilityRows,
} from "@/features/portfolio/risk/risk-figures";
import type { RiskRow } from "@/features/portfolio/risk/risk-figures";
import { useLinkedCharts } from "@/features/portfolio/risk/use-linked-charts";
import {
  formatBasisPoints,
  formatReferenceMonth,
  formatReferenceMonthCompact,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskChartsProps {
  report: RiskReport;
}

// RK7, RK8: the volatility of the portfolio and of each class, and the portfolio's fall from its
// peak, by month.
export function RiskCharts({ report }: RiskChartsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const linked = useLinkedCharts();

  const percent = (bp: number) => formatBasisPoints(bp, tag);
  const keys = [portfolioKey, ...volatilityKeys(report)];
  const records = (rows: readonly RiskRow[]): ChartRecord[] =>
    rows.map((r) => ({
      name: formatReferenceMonthCompact(r.month.slice(0, 7), tag),
      ...r.values,
    }));
  const volatility: ChartSeries[] = keys.map((key) => ({
    id: key,
    kind: "line",
    field: key,
    label: classLabel(t, key),
    format: percent,
  }));
  const drawdown: ChartSeries[] = [
    {
      id: portfolioKey,
      kind: "area",
      field: portfolioKey,
      label: classLabel(t, portfolioKey),
      format: percent,
    },
  ];
  const deepest = deepestFall(report);
  const volatilityData = records(volatilityRows(report));
  const drawdownData = records(drawdownRows(report));
  const shared = {
    zoomable: true,
    zoom: linked.zoom,
    onZoomChange: linked.setZoom,
    onActivePointChange: linked.setActive,
  };

  return (
    <Grid minItemWidth="md" gap={6}>
      <Chart
        size="sm"
        title={t("portfolio.risk.volatility")}
        data={volatilityData}
        activePoint={linked.pointOf(seriesWithValue(volatilityData, keys))}
        series={volatility}
        x={{ field: "name" }}
        y={{ format: percent }}
        trigger="axis"
        toolbar="hover"
        {...shared}
      />
      <Chart
        size="sm"
        title={t("portfolio.risk.drawdown")}
        description={
          deepest && (
            <Text size="sm" tone="muted">
              {t("portfolio.risk.deepest", {
                value: percent(deepest.bp),
                month: formatReferenceMonth(deepest.month.slice(0, 7), tag),
              })}
            </Text>
          )
        }
        data={drawdownData}
        activePoint={linked.pointOf(
          seriesWithValue(drawdownData, [portfolioKey]),
        )}
        series={drawdown}
        x={{ field: "name" }}
        y={{ format: percent }}
        legend={false}
        trigger="axis"
        toolbar="hover"
        {...shared}
      />
    </Grid>
  );
}
