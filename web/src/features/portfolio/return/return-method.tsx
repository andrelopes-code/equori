import type { components } from "@/api/schema.gen";
import { minAnnualDays } from "@/features/portfolio/model/annual-rate-days";
import type { YieldGroup } from "@/features/portfolio/model/yield-figures";
import { ReturnMethodLayer } from "@/features/portfolio/return/return-method-layer";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnMethodProps {
  report: ReturnReport;
  groups: YieldGroup[];
  // The calendar span of the period, both ends included; absent, the rate is stated (RE6).
  days?: number | undefined;
}

// PC12, RC6, L3, RK6: the annual rate in one line, and the button of the layer that holds the
// method. An expert opens it; a reader who only asked how it performed never has to. The closing
// balance and the period return are stated once, in the origin block and in the verdict.
export function ReturnMethod({ report, groups, days }: ReturnMethodProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const summary =
    report.annual_bp === undefined ||
    (days !== undefined && days < minAnnualDays)
      ? null
      : t("holdings.method.annual", {
          annual: formatBasisPoints(report.annual_bp, tag),
        });

  return (
    <DetailDialog
      title={t("holdings.method")}
      description={t("holdings.method.layer.description")}
      summary={summary}
      triggerLabel={t("holdings.method.open")}
    >
      <ReturnMethodLayer report={report} groups={groups} days={days} />
    </DetailDialog>
  );
}
