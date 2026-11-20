import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { riskQuery } from "@/features/portfolio/api";
import { CollapsibleSection } from "@/features/portfolio/collapsible-section/collapsible-section";
import { RiskBlock } from "@/features/portfolio/risk/risk-block";
import { RiskCharts } from "@/features/portfolio/risk/risk-charts";
import { RiskClassesTable } from "@/features/portfolio/risk/risk-classes-table";
import { RiskCoverageNotice } from "@/features/portfolio/risk/risk-coverage-notice";
import { RiskDetails } from "@/features/portfolio/risk/risk-details";
import { RiskVerdict } from "@/features/portfolio/risk/risk-verdict";
import { useT } from "@/i18n/i18n-provider";

interface RiskSectionProps {
  date: string;
  valueIn: string | undefined;
  // The value of the portfolio in the report's currency, in minor units.
  total: number;
}

const storageKey = "equori.portfolio.risk.collapsed";

// How often, and how many times, the report is read again after a request for missing prices:
// a feed tick fetches them within seconds, a slow source within a minute.
const refreshEvery = 5000;
const refreshTimes = 12;

// Portfolio risk design, Screen: three plain sentences first (how much the portfolio usually
// varies, its deepest fall, where the variation comes from), then the share of each class, the
// months behind the figures, and the terms in a closed block. The page draws the section only for
// a book with holdings, so it holds its place with a placeholder while the report loads.
export function RiskSection({ date, valueIn, total }: RiskSectionProps) {
  const t = useT();
  const api = useApi();
  const [requestedAt, setRequestedAt] = useState<number | undefined>();
  const risk = useQuery({
    ...riskQuery(api, date, valueIn),
    refetchInterval: (query) =>
      requestedAt !== undefined &&
      Date.now() - requestedAt < refreshEvery * refreshTimes &&
      (query.state.data?.left_out.length ?? 0) > 0
        ? refreshEvery
        : false,
  });

  if (risk.isSuccess && risk.data.portfolio.months.length === 0) return null;

  return (
    <CollapsibleSection
      title={t("portfolio.risk.title")}
      description={t("portfolio.risk.description")}
      storageKey={storageKey}
    >
      {risk.isPending && <Skeleton />}

      {risk.isError && (
        <Text size="sm" tone="danger">
          {t("portfolio.risk.error")}
        </Text>
      )}

      {risk.isSuccess && (
        <Stack gap={8}>
          <Stack gap={4}>
            <RiskVerdict report={risk.data} total={total} />
            <RiskCoverageNotice
              report={risk.data}
              requested={requestedAt !== undefined}
              onRequested={() => {
                setRequestedAt(Date.now());
              }}
            />
          </Stack>

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

          <RiskDetails report={risk.data} />
        </Stack>
      )}
    </CollapsibleSection>
  );
}
