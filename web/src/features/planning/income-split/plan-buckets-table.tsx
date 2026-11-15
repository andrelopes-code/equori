import {
  Table,
  TableBody,
  TableCaption,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import type { BucketTotals } from "@/features/planning/income-split/bucket-figures";
import { PlanBucketRow } from "@/features/planning/income-split/plan-bucket-row";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

interface PlanBucketsTableProps {
  totals: BucketTotals;
  format: PlanFormat;
}

// One row per bucket in method order, then the categories outside the split when they plan
// or spend anything.
export function PlanBucketsTable({ totals, format }: PlanBucketsTableProps) {
  const t = useT();
  const outside = totals.outsidePlanned > 0;

  return (
    <Table columns={5} variant="framed">
      <TableContent>
        <TableCaption>
          <VisuallyHidden>{t("buckets.title")}</VisuallyHidden>
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("buckets.col.bucket")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("buckets.col.share")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("buckets.col.target")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("buckets.col.planned")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("buckets.col.status")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {totals.buckets.map((b) => (
            <PlanBucketRow
              key={b.id}
              name={b.name}
              withSavings={b.takesSavings}
              share={format.share(b.shareBp)}
              target={b.target}
              planned={b.planned}
              format={format}
            />
          ))}
          {outside && (
            <PlanBucketRow
              name={t("buckets.outside")}
              withSavings={false}
              share={undefined}
              target={undefined}
              planned={totals.outsidePlanned}
              format={format}
            />
          )}
        </TableBody>
      </TableContent>
    </Table>
  );
}
