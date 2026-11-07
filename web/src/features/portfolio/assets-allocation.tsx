import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { allocationQuery } from "@/features/portfolio/api";
import { allocationLabel } from "@/features/portfolio/allocation-label";
import { AllocationTable } from "@/features/portfolio/allocation-table";
import { PortfolioProblem } from "@/features/portfolio/portfolio-problem";
import { allocationBys } from "@/features/portfolio/portfolio-search";
import type { AllocationBy } from "@/features/portfolio/portfolio-search";
import { institutionsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

interface AssetsAllocationProps {
  date: string;
  valueIn: string | undefined;
  by: AllocationBy;
  onBy: (by: AllocationBy) => void;
}

// PC21: every asset account at a date, grouped by type, currency or institution. The portfolio
// page reads the brokerage trees alone, so this wider base is named as what it is.
export function AssetsAllocation({
  date,
  valueIn,
  by,
  onBy,
}: AssetsAllocationProps) {
  const t = useT();
  const api = useApi();
  const scale = useScale();
  const allocation = useQuery(allocationQuery(api, date, by, valueIn));
  const institutions = useQuery({
    ...institutionsQuery(api),
    enabled: by === "institution",
  });

  const names = new Map((institutions.data ?? []).map((i) => [i.id, i.name]));
  const groups = allocation.data?.groups ?? [];
  const pending =
    allocation.isPending ||
    scale === null ||
    (by === "institution" && institutions.isPending);
  const rows = groups.map((g) => ({
    key: g.key,
    name: allocationLabel(t, by, g.key, names),
    value: g.value,
    share: g.share_bp,
  }));

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("report.assets.title")}</SectionHeading>
          <SectionDescription>{t("report.assets.note")}</SectionDescription>
        </SectionTitle>
        <SectionActions>
          <SegmentedControl
            size="sm"
            aria-label={t("report.assets.by")}
            value={by}
            onValueChange={(value) => {
              const next = allocationBys.find((b) => b === value);
              if (next !== undefined) onBy(next);
            }}
          >
            {allocationBys.map((b) => (
              <Segment key={b} value={b}>
                {t(`portfolio.by.${b}`)}
              </Segment>
            ))}
          </SegmentedControl>
        </SectionActions>
      </SectionHeader>
      <SectionBody>
        {allocation.isError && (
          <PortfolioProblem
            error={allocation.error}
            currency={valueIn}
            onRetry={() => void allocation.refetch()}
          />
        )}

        {!allocation.isError && !pending && groups.length === 0 && (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>
                {t("portfolio.allocation.empty")}
              </ResultStateTitle>
            </ResultStateContent>
          </ResultState>
        )}

        {!allocation.isError && (pending || groups.length > 0) && (
          <AllocationTable
            caption={t("report.assets.title")}
            shareHeader={t("report.assets.share")}
            rows={rows}
            total={allocation.data?.total}
            pending={pending}
          />
        )}
      </SectionBody>
    </Section>
  );
}
