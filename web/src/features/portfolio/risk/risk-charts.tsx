import type {
  ChartAnnotation,
  ChartRecord,
  ChartSeries,
} from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { alignedPlot } from "@/features/portfolio/risk/aligned-plot";
import { classLabel } from "@/features/portfolio/risk/class-label";
import { RiskBandKey } from "@/features/portfolio/risk/risk-band-key";
import {
  drawdownRows,
  portfolioKey,
  riskBands,
  seriesWithValue,
  volatilityKeys,
  volatilityRows,
} from "@/features/portfolio/risk/risk-figures";
import type { RiskBand, RiskRow } from "@/features/portfolio/risk/risk-figures";
import { translucentBands } from "@/features/portfolio/risk/translucent-bands";
import { useLinkedCharts } from "@/features/portfolio/risk/use-linked-charts";
import { formatBasisPoints, formatReferenceMonthCompact } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

// The engine's option with the two workarounds; one function for the life of the module, so the
// charts do not rebuild their option on each render.
const engineOption = (option: Record<string, unknown>) =>
  alignedPlot(translucentBands(option));

interface RiskChartsProps {
  report: RiskReport;
}

// RK7, RK8: the portfolio's volatility and its fall from the peak, one above the other on the
// same months, so a month sits at the same place on both. The class lines start hidden: the
// legend shows them. A band marks a run of months without a figure, and the key under the charts
// says why.
export function RiskCharts({ report }: RiskChartsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const linked = useLinkedCharts();

  const percent = (bp: number) => formatBasisPoints(bp, tag);
  const monthName = (month: string) =>
    formatReferenceMonthCompact(month.slice(0, 7), tag);
  const classKeys = volatilityKeys(report);
  // A book without a volatility yet draws no empty chart: the verdict says when it comes.
  const swings = report.portfolio.months.some(
    (m) => m.volatility_bp !== undefined,
  );
  const keys = [portfolioKey, ...classKeys];
  const records = (rows: readonly RiskRow[]): ChartRecord[] =>
    rows.map((r) => ({ name: monthName(r.month), ...r.values }));
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
  const volatilityData = records(volatilityRows(report));
  const drawdownData = records(drawdownRows(report));
  const bands = riskBands(report);
  const annotations = (list: readonly RiskBand[]): ChartAnnotation[] =>
    list.map((b) => ({
      kind: "band",
      axis: "x",
      from: monthName(b.from),
      to: monthName(b.to),
      tone: b.reason === "excluded" ? "warning" : "neutral",
    }));
  const shared = {
    size: "sm",
    x: { field: "name" },
    y: { format: percent },
    trigger: "axis",
    toolbar: "hover",
    zoomable: true,
    zoom: linked.zoom,
    onZoomChange: linked.setZoom,
    onActivePointChange: linked.setActive,
    extendOption: engineOption,
  } as const;

  return (
    <Stack gap={6}>
      {(swings || classKeys.length > 0) && (
        <Chart
          title={t("portfolio.risk.volatility")}
          data={volatilityData}
          series={volatility}
          defaultHidden={classKeys}
          annotations={annotations(bands.volatility)}
          activePoint={linked.pointOf(seriesWithValue(volatilityData, keys))}
          {...shared}
        />
      )}

      <Chart
        title={t("portfolio.risk.drawdown")}
        data={drawdownData}
        series={drawdown}
        legend={false}
        annotations={annotations(bands.drawdown)}
        activePoint={linked.pointOf(
          seriesWithValue(drawdownData, [portfolioKey]),
        )}
        {...shared}
      />

      <RiskBandKey bands={[...bands.volatility, ...bands.drawdown]} />
    </Stack>
  );
}
