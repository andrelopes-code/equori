import { Chart } from "@slotted/react/chart";
import type { ChartPoint, ChartSeries } from "@slotted/core/chart";

import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { dimUnchosen } from "@/features/portfolio/attribution/dim-unchosen";
import {
  yearChartData,
  yearZoom,
} from "@/features/portfolio/attribution/year-chart-data";
import type { YearChartRecord } from "@/features/portfolio/attribution/year-chart-data";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type AttributionYear = components["schemas"]["AttributionYear"];

interface YearChartProps {
  years: readonly AttributionYear[];
  chosen: number;
  onChoose: (year: number) => void;
}

// The return of every year as bars, beside the same money at the reference rate. A bar or the
// select above the chart picks the year the rows below detail; a history longer than twelve years
// opens on its last twelve and zooms to the older ones.
export function YearChart({ years, chosen, onChoose }: YearChartProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const data = yearChartData(years);
  const zoom = yearZoom(years.length);
  const chosenIndex = years.findIndex((y) => y.year === chosen);
  const rateIndex = years.find((y) => y.rate !== undefined)?.rate?.index;
  const percent = (bp: number) => formatBasisPoints(bp, tag);
  const series: ChartSeries<keyof YearChartRecord>[] = [
    {
      id: "portfolio",
      kind: "bar",
      field: "portfolio",
      label: t("portfolio.attribution.legend.portfolio"),
      format: percent,
    },
  ];

  if (rateIndex !== undefined) {
    series.push({
      id: "rate",
      kind: "bar",
      field: "rate",
      label: t("portfolio.attribution.legend.rate", {
        index: indexName(rateIndex),
      }),
      tone: "neutral",
      format: percent,
    });
  }

  const choices = [...years]
    .reverse()
    .map((y) => ({ value: String(y.year), label: String(y.year) }));

  function handleSelection(point: ChartPoint | null) {
    if (point === null) return;

    onChoose(Number(point.key));
  }

  function handleChoice(value: string | string[] | null) {
    if (typeof value !== "string") return;

    onChoose(Number(value));
  }

  return (
    <Chart
      title={t("portfolio.attribution.years")}
      data={data}
      series={series}
      x={{ field: "year" }}
      y={{ format: percent }}
      locale={tag}
      selectable
      selection={{ series: "portfolio", key: String(chosen) }}
      onSelectionChange={handleSelection}
      extendOption={(option) => dimUnchosen(option, chosenIndex)}
      {...(zoom === undefined ? {} : { zoomable: true, defaultZoom: zoom })}
      actions={
        <ChoiceSelect
          label={t("portfolio.attribution.yearChoice")}
          choices={choices}
          value={String(chosen)}
          multiple={false}
          onChange={handleChoice}
        />
      }
    />
  );
}
