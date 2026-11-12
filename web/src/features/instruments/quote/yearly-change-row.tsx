import { Inline } from "@slotted/react/inline";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import type { YearlyChange } from "@/features/instruments/model/yearly-changes";
import { formatDate, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";

interface YearlyChangeRowProps {
  row: YearlyChange;
  quote: string;
}

export function YearlyChangeRow({ row, quote }: YearlyChangeRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const price = usePriceFormat(quote);
  const amountTone = useAmountTone();
  const tone = amountTone("result", directionOf(row.changeBp ?? 0));
  const start = price.text(row.start.value);
  const end = price.text(row.end.value);

  return (
    <TableRow value={String(row.year)}>
      <TableRowHeader>
        <Inline gap={4} align="center" wrap="wrap">
          {row.year}
          {row.partialFrom && (
            <Text size="sm" tone="muted">
              {t("instrument.yearly.from", {
                date: formatDate(row.start.date, locale),
              })}
            </Text>
          )}
          {row.partialTo && (
            <Text size="sm" tone="muted">
              {t("instrument.yearly.to", {
                date: formatDate(row.end.date, locale),
              })}
            </Text>
          )}
        </Inline>
      </TableRowHeader>
      <TableCell numeric>{start}</TableCell>
      <TableCell numeric>{end}</TableCell>
      <TableCell numeric>
        <Text size="sm" numeric="tabular" tone={tone}>
          {changeText(row.changeBp, fmt.hidden, locale)}
        </Text>
      </TableCell>
    </TableRow>
  );
}

function changeText(bp: number | null, hidden: boolean, locale: string) {
  if (bp === null) return "—";

  return hidden ? MASK : formatSignedBasisPoints(bp, locale);
}
