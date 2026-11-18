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

import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { BucketHistoryAction } from "@/features/planning/income-split/versions/bucket-history-action";
import { BucketDialog } from "@/features/planning/income-split/bucket-dialog";
import type { BucketTotals } from "@/features/planning/income-split/bucket-figures";
import { PlanBucketsOutside } from "@/features/planning/income-split/plan-buckets-outside";
import { PlanBucketsTable } from "@/features/planning/income-split/plan-buckets-table";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

type Bucket = components["schemas"]["BudgetBucket"];

interface PlanBucketsProps {
  // Undefined while the book has no bucket method.
  totals: BucketTotals | undefined;
  // What the plan leaves to distribute; undefined without a reference.
  unassigned: number | undefined;
  format: PlanFormat;
  // The stored method, which the dialog edits; undefined while the book has none.
  stored: readonly Bucket[] | undefined;
  entries: readonly CategoryEntry[];
  // The month on screen.
  month: string;
  // The number of categories outside the split of the month.
  outside: number;
}

// The income split of the month (income buckets spec 5): each bucket's share, target,
// planned amounts, or the invitation to set one up.
export function PlanBuckets({
  totals,
  unassigned,
  format,
  stored,
  entries,
  month,
  outside,
}: PlanBucketsProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("buckets.title")}</SectionHeading>
          <SectionDescription>
            {totals === undefined
              ? t("buckets.empty")
              : t("buckets.plan.description")}
          </SectionDescription>
        </SectionTitle>
        <SectionActions>
          <BucketHistoryAction month={month} entries={entries} />

          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={() => {
              setEditing(true);
            }}
          >
            {totals === undefined ? t("buckets.setUp") : t("buckets.edit")}
          </Button>
        </SectionActions>
      </SectionHeader>

      {totals !== undefined && (
        <SectionBody>
          <PlanBucketsTable
            totals={totals}
            unassigned={unassigned}
            format={format}
          />
          <PlanBucketsOutside
            count={outside}
            onPlace={() => {
              setEditing(true);
            }}
          />
        </SectionBody>
      )}
      {editing && (
        <BucketDialog
          stored={stored}
          entries={entries}
          month={month}
          onClose={() => {
            setEditing(false);
          }}
        />
      )}
    </Section>
  );
}
