import { Skeleton } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { TrendLine, pricesQuery } from "@/features/instruments";
import { priceValues } from "@/features/portfolio/holdings/price-values";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { shiftDate } from "@/i18n/format";

interface HoldingTrendCellProps {
  holding: Holding;
  date: string;
}

// The last 90 days of the price of the instrument, in the quote instrument of its latest price.
// Empty for cash, for a row without a price and when the request fails.
export function HoldingTrendCell({ holding, date }: HoldingTrendCellProps) {
  const api = useApi();
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

  return (
    <TrendLine
      data={priceValues(prices.data)}
      quote={quote}
      name={holding.name}
    />
  );
}
