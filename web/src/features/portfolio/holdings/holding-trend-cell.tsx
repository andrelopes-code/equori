import { Skeleton } from "@slotted/react/skeleton";
import { Sparkline } from "@slotted/react/sparkline";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { pricesQuery } from "@/features/instruments";
import { holdingTrend } from "@/features/portfolio/holdings/holding-trend";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { useScale } from "@/features/setup";
import { numberFormatter, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useAmountTone } from "@/ui/money/amount-tone";

interface HoldingTrendCellProps {
  holding: Holding;
  date: string;
}

// The last 90 days of the price of the instrument, in the quote instrument of its latest price.
// Empty for cash, for a row without a price, while fewer than 3 prices exist and when the request
// fails. The tone follows the direction of the period, unless the reader chose sign-only amounts.
export function HoldingTrendCell({ holding, date }: HoldingTrendCellProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const scale = useScale();
  const api = useApi();
  const amountTone = useAmountTone();
  const quote = holding.position?.prices?.find(
    (p) => p.instrument === holding.code,
  )?.quote_instrument;
  const prices = useQuery({
    ...pricesQuery(api, holding.code, quote ?? "", shiftDate(date, -89), date),
    enabled: holding.kind === "position" && quote !== undefined,
  });

  if (holding.kind !== "position" || quote === undefined || prices.isError)
    return null;
  if (prices.data === undefined)
    return <Skeleton shape="block" blockSize="20px" />;

  const trend = holdingTrend(prices.data);
  if (trend === null) return null;

  const tone = amountTone("result", trend.direction);
  const digits = numberFormatter(tag, {
    maximumFractionDigits: scale?.(quote) ?? 2,
  });

  return (
    <Sparkline
      size="sm"
      data={trend.data}
      reference={trend.first}
      {...(tone === "inherit" ? {} : { tone })}
      label={t("holdings.trendOf", { name: holding.name })}
      valueFormatter={digits.format}
    />
  );
}
