import { Sparkline } from "@slotted/react/sparkline";

import { seriesTrend } from "@/features/instruments/price-trend/series-trend";
import { useScale } from "@/features/setup";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useAmountTone } from "@/ui/money/amount-tone";

interface TrendLineProps {
  // The prices over the last 3 months, oldest first; null before the first price.
  data: readonly (number | null)[];
  // The instrument the prices are quoted in: its scale writes the values of the description.
  quote: string;
  name: string;
}

// The line of the price of an instrument over 3 months, beside its figures. The tone follows the
// direction of the period, unless the reader chose sign-only amounts. Nothing below 3 prices.
export function TrendLine({ data, quote, name }: TrendLineProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const scale = useScale();
  const amountTone = useAmountTone();
  const trend = seriesTrend(data);

  if (trend === null) return null;

  const tone = amountTone("result", trend.direction);
  const digits = numberFormatter(tag, {
    maximumFractionDigits: scale?.(quote) ?? 2,
  });

  return (
    <Sparkline
      size="sm"
      data={[...trend.data]}
      reference={trend.first}
      {...(tone === "inherit" ? {} : { tone })}
      label={t("instruments.trendOf", { name })}
      valueFormatter={digits.format}
    />
  );
}
