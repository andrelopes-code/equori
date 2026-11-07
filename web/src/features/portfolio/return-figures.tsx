import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { ReturnMethod } from "@/features/portfolio/return-method";
import { yieldGroups } from "@/features/portfolio/yield-figures";
import { YieldGroupList } from "@/features/portfolio/yield-group-list";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnFiguresProps {
  report: ReturnReport;
}

// PC11, PC12: the figures read as on an account's page, one group per period, then what the profile
// means and the method. A report no index compares states one figure instead.
export function ReturnFigures({ report }: ReturnFiguresProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const groups = yieldGroups(report, t, tag);
  const index = report.benchmark && indexName(report.benchmark.index);
  const period = report.period_bp;
  const lone = period ?? report.annual_bp;
  const loneLabel = t(
    period === undefined
      ? "holdings.return.personal"
      : "holdings.return.period",
  );

  return (
    <Stack gap={4}>
      {groups.length > 0 && (
        <Grid minItemWidth="md" gap={8}>
          {groups.map((group) => (
            <YieldGroupList key={group.key} group={group} />
          ))}
        </Grid>
      )}

      {groups.length === 0 && (
        <FigureGrid label={loneLabel}>
          <FigureCard
            label={loneLabel}
            value={formatBasisPoints(lone, tag)}
            note=""
            goodWhen="none"
            attention={lone < 0 ? "danger" : undefined}
          />
        </FigureGrid>
      )}

      {index !== undefined && (
        <Text size="sm" tone="muted">
          {t(`portfolio.yield.profile.${report.profile}`, { index })}
        </Text>
      )}

      <ReturnMethod report={report} />
    </Stack>
  );
}
