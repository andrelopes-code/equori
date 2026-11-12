import type { netWorthRows } from "@/features/reports/model/net-worth-months";
import { NetWorthTable } from "@/features/reports/net-worth/net-worth-table";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

interface NetWorthMonthsLayerProps {
  rows: ReturnType<typeof netWorthRows>;
  pending: boolean;
  currency: string;
  digits: number;
}

// L7: the summary line of the month ends and the button of the layer that lists each month.
export function NetWorthMonthsLayer({
  rows,
  pending,
  currency,
  digits,
}: NetWorthMonthsLayerProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const valued = rows.filter((row) => row.net !== undefined);
  const first = valued.at(0);
  const last = valued.at(-1);

  if (pending || first === undefined || last === undefined) return null;

  return (
    <DetailDialog
      title={t("report.netWorth.title")}
      description={t("report.netWorth.months.layer.description")}
      summary={t("report.netWorth.months.summary", {
        count: valued.length,
        from: formatReferenceMonth(first.month, tag),
        to: formatReferenceMonth(last.month, tag),
      })}
      triggerLabel={t("report.netWorth.months.open")}
    >
      <NetWorthTable
        rows={rows}
        title={t("report.netWorth.title")}
        currency={currency}
        digits={digits}
      />
    </DetailDialog>
  );
}
