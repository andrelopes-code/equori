import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { formatDate } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

interface PriceDateCellProps {
  row: CatalogRow;
}

export function PriceDateCell({ row }: PriceDateCellProps) {
  const [locale] = useAppLocale();

  if (row.lastDate === "") return null;

  return formatDate(row.lastDate, locale);
}
