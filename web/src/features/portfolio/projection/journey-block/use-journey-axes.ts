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

// PX6: one money axis, and a time axis whose label writes the calendar year and, beside it, the
// age the person reaches in that year.
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
  // Workaround for Slotted issue #197: a time axis takes no explicit ticks and no second label
  // line, so the age stands beside the year of each tick in place of the decades of age of the mock.
  const year = (ms: number) => {
    const iso = new Date(ms).toISOString().slice(0, 10);

    return t("portfolio.projection.journey.axis", {
      year: formatYear(iso, tag),
      age: Number(iso.slice(0, 4)) - birthYear,
    });
  };

  return {
    x: { field: "date", type: "time", format: year },
    y: { format: short, labelWidth },
    exact,
  };
}
