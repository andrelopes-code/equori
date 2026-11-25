import type {
  ChartNumberFormat,
  ChartXAxis,
  ChartYAxis,
} from "@slotted/core/chart";

import type { JourneyField } from "@/features/portfolio/projection/journey-block/journey-rows";
import { formatYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The pixels the value labels take: the figures reach millions.
const labelWidth = 112;

export interface JourneyAxes {
  x: ChartXAxis<JourneyField>;
  y: ChartYAxis;
  // The amount of a tooltip, to the minor unit.
  exact: ChartNumberFormat;
}

// PX6: one money axis, and a time axis whose label writes the calendar year and, beside it, the
// age the person reaches in that year.
export function useJourneyAxes(
  currency: string,
  scale: number,
  birthYear: number,
): JourneyAxes {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const whole = (value: number) =>
    fmt.money({ amount: Math.round(value), currency }, 0);
  const exact = (value: number) =>
    fmt.money({ amount: Math.round(value * 10 ** scale), currency }, scale);
  const year = (ms: number) => {
    const iso = new Date(ms).toISOString().slice(0, 10);

    return t("portfolio.projection.journey.axis", {
      year: formatYear(iso, tag),
      age: Number(iso.slice(0, 4)) - birthYear,
    });
  };

  return {
    x: { field: "date", type: "time", format: year },
    y: { format: whole, labelWidth },
    exact,
  };
}
