import { Chart } from "@slotted/react/chart";

import forms from "@/features/assistant/view/forms/forms.module.css";
import { axisLabels } from "@/features/assistant/view/plot/axis-labels";
import { plotChart } from "@/features/assistant/view/plot/plot-chart";
import { plotRecords } from "@/features/assistant/view/plot/plot-records";
import styles from "@/features/assistant/view/plot/plot-body.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { ViewPlot, ViewValue } from "@/features/assistant/view/view-types";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface PlotBodyProps {
  title: string;
  plot: ViewPlot;
  rows: ViewValue[][];
  // The table as written: the head keys translated and each value formatted.
  head: string[];
  labels: string[][];
}

// The rows of a view drawn as the chart the model described (answer views design, V36). Every
// number goes back through its unit's formatter, so privacy mode masks amounts.
export function PlotBody({ title, plot, rows, head, labels }: PlotBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();

  const axis = axisLabels(rows, plot.label, labels, locale);
  const { records, series } = plotRecords(rows, axis, plot);
  const chart = plotChart({
    series,
    head,
    marks: plot.marks,
    write: (v) => valueText(v, format),
    tick: (v) =>
      v.money === undefined
        ? valueText(v, format)
        : format.whole(v.money, false),
    average: (value) => t("assistantView.chart.average", { value }),
  });

  return (
    <div className={styles.plot}>
      <Chart
        aria-label={title}
        size="sm"
        toolbar="none"
        locale={locale}
        legend={chart.legend}
        legendOverflow="wrap"
        legendValues={chart.trigger === "item"}
        trigger={chart.trigger}
        orientation={plot.orientation}
        stackMode={plot.stack_mode}
        data={records}
        series={chart.series}
        annotations={chart.annotations}
        x={{ field: "label" }}
        y={chart.y}
      />

      {chart.averages.length > 0 && (
        <ul className={forms.legend}>
          {chart.averages.map((text) => (
            <li key={text}>
              <i className={styles.keyAverage} />
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
