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

import { allocationLabel } from "@/features/portfolio/allocation-label";
import { AllocationTable } from "@/features/portfolio/allocation-table";
import { holdingGroups } from "@/features/portfolio/portfolio-holdings";
import type { Holding } from "@/features/portfolio/portfolio-holdings";
import { allocationBys } from "@/features/portfolio/portfolio-search";
import type { AllocationBy } from "@/features/portfolio/portfolio-search";
import { useT } from "@/i18n/i18n-provider";

interface WhereMoneySectionProps {
  holdings: readonly Holding[];
  institutions: ReadonlyMap<string, string>;
  by: AllocationBy;
  total: number;
  valueIn: string | undefined;
  pending: boolean;
  onBy: (by: AllocationBy) => void;
}

// PC5, PC6: the portfolio by type, currency or institution. The control also groups the list under
// this section, so a reader sees the same groups in both.
export function WhereMoneySection({
  holdings,
  institutions,
  by,
  total,
  valueIn,
  pending,
  onBy,
}: WhereMoneySectionProps) {
  const t = useT();
  const currency = valueIn ?? "";
  const rows = holdingGroups(holdings, by).map((g) => ({
    key: g.key,
    name: allocationLabel(t, by, g.key, institutions),
    value: { amount: g.value, currency },
    share: g.share,
  }));

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("holdings.where")}</SectionHeading>
          <SectionDescription>{t("holdings.where.note")}</SectionDescription>
        </SectionTitle>
        <SectionActions>
          <SegmentedControl
            size="sm"
            aria-label={t("holdings.by")}
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
        <AllocationTable
          caption={t("holdings.where")}
          shareHeader={t("portfolio.share")}
          rows={rows}
          total={{ amount: total, currency }}
          pending={pending}
        />
      </SectionBody>
    </Section>
  );
}
