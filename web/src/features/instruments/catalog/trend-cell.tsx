import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { TrendLine } from "@/features/instruments/price-trend/trend-line";

interface TrendCellProps {
  row: CatalogRow;
}

// The line of the price over 3 months, read with the quotes of the catalog (IQ13).
export function TrendCell({ row }: TrendCellProps) {
  return <TrendLine data={row.trend} quote={row.priceQuote} name={row.code} />;
}
