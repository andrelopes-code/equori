import type { components } from "@/api/schema.gen";
import { yieldGroups } from "@/features/portfolio/model/yield-figures";
import { ReturnMethodLayer } from "@/features/portfolio/return/return-method-layer";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnMethodActionProps {
  // Absent while the read waits and when the period exceeds 3,660 days (PR9).
  report: ReturnReport | undefined;
}

// PR9: the existing method layer, opened from the header of the block.
export function ReturnMethodAction({ report }: ReturnMethodActionProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (report === undefined) return null;

  return (
    <DetailDialog
      title={t("holdings.method")}
      description={t("holdings.method.layer.description")}
      summary={null}
      triggerLabel={t("portfolio.results.method")}
    >
      <ReturnMethodLayer report={report} groups={yieldGroups(report, t, tag)} />
    </DetailDialog>
  );
}
