import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { priceSeriesQuery } from "@/features/instruments/api";
import { adjustedPrices } from "@/features/instruments/model/adjusted-prices";
import { rangeWindow } from "@/features/instruments/model/price-window";
import { yearlyChanges } from "@/features/instruments/model/yearly-changes";
import { YearlyChangeRow } from "@/features/instruments/quote/yearly-change-row";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface YearlyChangesProps {
  code: string;
  quote: string;
  first: string | null;
}

// YP1 to YP8: the price change of each calendar year, read from the series of the range max.
export function YearlyChanges({ code, quote, first }: YearlyChangesProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const { from, to } = rangeWindow(today, "max", first);
  const series = useQuery(priceSeriesQuery(api, code, quote, from, to));
  const rows = yearlyChanges(adjustedPrices(series.data?.items ?? []), today);

  if (rows.length === 0) return null;

  return (
    <Stack gap={2}>
      <Table columns={4} variant="framed">
        <TableContent aria-label={t("instrument.yearly.title")}>
          <TableHead>
            <TableRow>
              <TableColumnHeader>
                {t("instrument.yearly.col.year")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("instrument.yearly.col.start")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("instrument.yearly.col.end")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("instrument.yearly.col.change")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <YearlyChangeRow key={row.year} row={row} quote={quote} />
            ))}
          </TableBody>
        </TableContent>
      </Table>

      <Text size="sm" tone="muted">
        {t("instrument.yearly.note")}
      </Text>
    </Stack>
  );
}
