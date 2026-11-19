import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { riskQuery } from "@/features/portfolio/api";
import { CollapsibleSection } from "@/features/portfolio/collapsible-section/collapsible-section";
import { RiskCharts } from "@/features/portfolio/risk/risk-charts";
import { RiskClassesTable } from "@/features/portfolio/risk/risk-classes-table";
import { RiskCorrelationsTable } from "@/features/portfolio/risk/risk-correlations-table";
import { RiskNotes } from "@/features/portfolio/risk/risk-notes";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface RiskSectionProps {
  date: string;
  valueIn: string | undefined;
}

const storageKey = "equori.portfolio.risk.collapsed";

// Portfolio risk design, Screen: how much the portfolio swings, how far it fell and which class
// carries the swing, month by month. The section waits for the report: a book without a month
// draws nothing, so a placeholder would announce a section that may never come.
export function RiskSection({ date, valueIn }: RiskSectionProps) {
  const t = useT();
  const api = useApi();
  const risk = useQuery(riskQuery(api, date, valueIn));

  if (risk.isPending) return null;

  if (!risk.isError && risk.data.portfolio.months.length === 0) return null;

  return (
    <CollapsibleSection
      title={t("portfolio.risk.title")}
      description={t("portfolio.risk.description")}
      storageKey={storageKey}
    >
      {risk.isError && <FormNotice>{t("portfolio.risk.error")}</FormNotice>}

      {risk.isSuccess && (
        <Stack gap={6}>
          <RiskCharts report={risk.data} />
          <RiskClassesTable report={risk.data} />
          <RiskCorrelationsTable report={risk.data} />
          <RiskNotes report={risk.data} />
        </Stack>
      )}
    </CollapsibleSection>
  );
}
