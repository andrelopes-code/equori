import { Button } from "@slotted/react/button";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { BucketTotals } from "@/features/planning/income-split/bucket-figures";
import { PlanBucketsTable } from "@/features/planning/income-split/plan-buckets-table";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

interface PlanBucketsProps {
  // Undefined while the book has no bucket method.
  totals: BucketTotals | undefined;
  outsideSpent: number;
  // The plan's month as a month name.
  month: string;
  format: PlanFormat;
  onEdit: () => void;
}

// The income split of the month (income buckets spec 5): each bucket's share, target,
// planned and spent amounts, or the invitation to set one up.
export function PlanBuckets({
  totals,
  outsideSpent,
  month,
  format,
  onEdit,
}: PlanBucketsProps) {
  const t = useT();

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("buckets.title")}</SectionHeading>
          <SectionDescription>
            {totals === undefined
              ? t("buckets.empty")
              : t("buckets.description")}
          </SectionDescription>
        </SectionTitle>
        <SectionActions>
          <Button size="sm" variant="outline" tone="secondary" onClick={onEdit}>
            {totals === undefined ? t("buckets.setUp") : t("buckets.edit")}
          </Button>
        </SectionActions>
      </SectionHeader>

      {totals !== undefined && (
        <SectionBody>
          <PlanBucketsTable
            totals={totals}
            outsideSpent={outsideSpent}
            month={month}
            format={format}
          />
        </SectionBody>
      )}
    </Section>
  );
}
