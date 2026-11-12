import type { components } from "@/api/schema.gen";
import type { YieldGroup } from "@/features/portfolio/model/yield-figures";
import { ReturnMethodLayer } from "@/features/portfolio/return/return-method-layer";
import { useScale } from "@/features/setup";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnMethodProps {
  report: ReturnReport;
  groups: YieldGroup[];
}

// PC12, RC6, L3: the closing value and both rates in one line, and the button of the layer that
// holds the method. An expert opens it; a reader who only asked how it performed never has to.
export function ReturnMethod({ report, groups }: ReturnMethodProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const closing = fmt.money(
    report.closing,
    scale?.(report.closing.currency) ?? 0,
  );
  const annual = formatBasisPoints(report.annual_bp, tag);
  const summary =
    report.period_bp === undefined
      ? t("holdings.method.summaryNoPeriod", { closing, annual })
      : t("holdings.method.summary", {
          closing,
          period: formatBasisPoints(report.period_bp, tag),
          annual,
        });

  return (
    <DetailDialog
      title={t("holdings.method")}
      description={t("holdings.method.layer.description")}
      summary={summary}
      triggerLabel={t("holdings.method.open")}
    >
      <ReturnMethodLayer report={report} groups={groups} />
    </DetailDialog>
  );
}
