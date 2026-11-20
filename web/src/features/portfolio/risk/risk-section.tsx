import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { riskQuery } from "@/features/portfolio/api";
import { CollapsibleSection } from "@/features/portfolio/collapsible-section/collapsible-section";
import { RiskBlock } from "@/features/portfolio/risk/risk-block";
import { RiskCharts } from "@/features/portfolio/risk/risk-charts";
import { RiskClassesTable } from "@/features/portfolio/risk/risk-classes-table";
import { RiskCorrelationsTable } from "@/features/portfolio/risk/risk-correlations-table";
import { RiskCoverageNotice } from "@/features/portfolio/risk/risk-coverage-notice";
import { RiskVerdict } from "@/features/portfolio/risk/risk-verdict";
import { useT } from "@/i18n/i18n-provider";

interface RiskSectionProps {
  date: string;
  valueIn: string | undefined;
}

const storageKey = "equori.portfolio.risk.collapsed";

// Portfolio risk design, Screen: the verdict first (how much the portfolio swings, how deep it
// fell, which class carries the swing), then where the swing comes from, the months behind it and
// how the classes move together. A book without a month draws nothing.
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
      {risk.isError && (
        <Text size="sm" tone="danger">
          {t("portfolio.risk.error")}
        </Text>
      )}

      {risk.isSuccess && (
        <Stack gap={8}>
          <RiskVerdict report={risk.data} />
          <RiskCoverageNotice report={risk.data} />

          <RiskBlock
            title={t("portfolio.risk.sources")}
            description={t("portfolio.risk.sourcesHint")}
          >
            <RiskClassesTable report={risk.data} />
          </RiskBlock>

          <RiskBlock
            title={t("portfolio.risk.history")}
            description={t("portfolio.risk.historyHint")}
          >
            <RiskCharts report={risk.data} />
          </RiskBlock>

          {risk.data.correlations.length > 0 && (
            <RiskBlock
              title={t("portfolio.risk.correlations")}
              description={t("portfolio.risk.correlationsHint")}
            >
              <RiskCorrelationsTable report={risk.data} />
            </RiskBlock>
          )}
        </Stack>
      )}
    </CollapsibleSection>
  );
}
