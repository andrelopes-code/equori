import type { Indicators } from "@/features/overview";
import { IndicatorAuditLayer } from "@/features/reports/indicator-audit/indicator-audit-layer";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

export interface IndicatorAuditProps {
  report: Indicators;
  incomplete: boolean;
}

// Every figure of the payload month by month, for a reader who audits a number of the cards
// above, and the definitions of the ratios. It opens in a layer: no question of the tab needs it
// (DL1).
export function IndicatorAudit({ report, incomplete }: IndicatorAuditProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const first = report.months.at(0);
  const last = report.months.at(-1);

  if (first === undefined || last === undefined) return null;

  return (
    <DetailDialog
      title={t("report.indicators.audit.title")}
      description={t("report.indicators.audit.layer.description")}
      summary={t("report.indicators.audit.summary", {
        months: report.months.length,
        from: formatReferenceMonth(first.month, locale),
        to: formatReferenceMonth(last.month, locale),
      })}
      triggerLabel={t("report.indicators.audit.open")}
    >
      <IndicatorAuditLayer report={report} incomplete={incomplete} />
    </DetailDialog>
  );
}
