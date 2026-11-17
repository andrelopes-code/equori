import { Grid } from "@slotted/react/grid";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { indicatorsQuery } from "@/features/overview";
import { FlowsChart } from "@/features/reports/indicator-charts/flows-chart";
import { IndicatorAudit } from "@/features/reports/indicator-audit/indicator-audit";
import { IndicatorBoard } from "@/features/reports/indicator-board/indicator-board";
import { IndicatorVerdictCard } from "@/features/reports/indicator-verdict/indicator-verdict-card";
import { IndicatorsSkeleton } from "@/features/reports/indicators/indicators-skeleton";
import { RateChart } from "@/features/reports/indicator-charts/rate-chart";
import { ReportControls } from "@/features/reports/report-controls/report-controls";
import { ReserveChart } from "@/features/reports/indicator-charts/reserve-chart";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MonthControl } from "@/ui/navigation/month-control";
import { QueryError } from "@/ui/feedback/query-error";
import { PageStack } from "@/ui/page-layout/page-stack";

interface IndicatorsTabProps {
  month: string;
  onMonth: (month: string) => void;
}

// The tab answers in the order a reader asks: is the month inside the usual range, how much reserve
// stands against the debts, where the savings came from (indicators tab design, D1).
export function IndicatorsTab({ month, onMonth }: IndicatorsTabProps) {
  const t = useT();
  const today = useToday();
  const query = useQuery(indicatorsQuery(useApi(), month));
  const report = query.data;
  const incomplete = month === today.slice(0, 7);
  const controls = (
    <ReportControls
      start={
        <MonthControl
          value={month}
          onChange={onMonth}
          label={t("report.indicators.month")}
        />
      }
    />
  );

  if (query.error !== null)
    return (
      <PageStack>
        {controls}
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </PageStack>
    );

  if (report === undefined)
    return (
      <PageStack>
        {controls}
        <IndicatorsSkeleton />
      </PageStack>
    );

  return (
    <PageStack>
      {controls}

      <IndicatorVerdictCard
        report={report}
        incomplete={incomplete}
        today={today}
      />

      <IndicatorBoard report={report} incomplete={incomplete} />

      <ReserveChart report={report} incomplete={incomplete} />

      <Grid columns={2} gap={6} minItemWidth="lg">
        <FlowsChart report={report} incomplete={incomplete} />
        <RateChart report={report} incomplete={incomplete} />
      </Grid>

      <IndicatorAudit report={report} incomplete={incomplete} />
    </PageStack>
  );
}
