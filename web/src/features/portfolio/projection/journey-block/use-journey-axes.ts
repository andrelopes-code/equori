import type {
  ChartNumberFormat,
  ChartXAxis,
  ChartYAxis,
} from "@slotted/core/chart";

import type { JourneyField } from "@/features/portfolio/projection/journey-block/journey-rows";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import { formatYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The pixels the value labels take in the compact form ("R$ 2,5 mi").
const labelWidth = 72;

export interface JourneyAxes {
  x: ChartXAxis<JourneyField>;
  y: ChartYAxis;
  // The amount of a tooltip, to the minor unit.
  exact: ChartNumberFormat;
}

// PX6: one money axis, and a time axis with a tick at each decade of age: the age the person
// reaches in that year, and the calendar year under it.
export function useJourneyAxes(
  currency: string,
  scale: number,
  birthYear: number,
): JourneyAxes {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const short = (value: number) => money.compact(value * 10 ** scale);
  const exact = (value: number) => money.exact(value * 10 ** scale);
  const age = (ms: number) =>
    t("portfolio.projection.journey.axis", {
      age: new Date(ms).getUTCFullYear() - birthYear,
    });
  const year = (date: Date) => formatYear(date.toISOString().slice(0, 10), tag);

  return {
    x: {
      field: "date",
      type: "time",
      format: age,
      ticks: decadesOfAge(birthYear),
      secondary: year,
    },
    y: { format: short, labelWidth },
    exact,
  };
}

// Every decade of a life: a tick outside the plotted years is not drawn.
function decadesOfAge(birthYear: number): string[] {
  return Array.from(
    { length: 12 },
    (_, decade) => `${String(birthYear + (decade + 1) * 10)}-01-01`,
  );
}
