import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { latestPriceQuery } from "@/features/instruments/api";
import type { CatalogRow } from "@/features/instruments/catalog-rows";
import { formatRate } from "@/features/instruments/rate";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The latest price of a row, or its date. A row asks for it when the grid mounts the row, so a
// catalog of 150 instruments sends the requests of the rows in view only. A unit price is masked
// like the average cost of a position (positions-tab.tsx).
export function LatestPriceCell({
  row,
  part,
}: {
  row: CatalogRow;
  part: "price" | "date";
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const quoted = row.priceQuote !== "";
  const latest = useQuery({
    ...latestPriceQuery(api, row.code, row.priceQuote, today),
    enabled: quoted,
  });
  if (!quoted || latest.isPending) return null;
  if (latest.isError)
    return part === "price" ? (
      <Text size="sm" tone="muted">
        {t("instruments.price.loadFailed")}
      </Text>
    ) : null;
  const price = latest.data;
  if (price === null)
    return part === "price" ? (
      <Text size="sm" tone="muted">
        {t("instruments.noPrice")}
      </Text>
    ) : null;
  if (part === "date") return formatDate(price.date, locale);
  return fmt.hidden ? MASK : formatRate(price.value, locale);
}
