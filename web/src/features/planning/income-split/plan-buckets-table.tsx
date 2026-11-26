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

import { useState } from "react";

import type { components } from "@/api/schema.gen";

import type { BucketTotals } from "@/features/planning/income-split/bucket-figures";
import { PlanBucketRow } from "@/features/planning/income-split/plan-bucket-row";
import { PlanOutsideRow } from "@/features/planning/income-split/plan-outside-row";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { InstallmentsDrawer } from "@/features/planning/plan-installments/installments-drawer";
import { useT } from "@/i18n/i18n-provider";

type Installment = components["schemas"]["BudgetPlanInstallment"];

interface PlanBucketsTableProps {
  totals: BucketTotals;
  // What the plan leaves to distribute; undefined without a reference.
  unassigned: number | undefined;
  // The charges behind the installments row, and the month they are billed in.
  installments: readonly Installment[];
  month: string;
  format: PlanFormat;
}

const rowNames = {
  installments: "plan.installments",
  savings: "plan.savings",
  goalDeposits: "plan.goalDeposits",
} as const;

// The screen that plans each figure no bucket takes; the installments open their drawer instead.
const rowLinks = {
  installments: undefined,
  savings: "/portfolio/contribution-plan",
  goalDeposits: "/goals",
} as const;

// One row per bucket in method order, the categories outside the split when they plan
// anything, the figures no bucket takes and what is left to distribute: the planned column
// sums to the reference (planning coherence A258).
export function PlanBucketsTable({
  totals,
  unassigned,
  installments,
  month,
  format,
}: PlanBucketsTableProps) {
  const t = useT();

  const [open, setOpen] = useState(false);

  const outside = totals.outsidePlanned > 0;
  const installmentsTotal =
    totals.rows.find((r) => r.key === "installments")?.amount ?? 0;

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

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
              measure={b.measure}
              share={format.share(b.shareBp)}
              target={b.target}
              planned={b.planned}
              format={format}
            />
          ))}
          {outside && (
            <PlanBucketRow
              name={t("buckets.outside")}
              measure={undefined}
              share={undefined}
              target={undefined}
              planned={totals.outsidePlanned}
              format={format}
            />
          )}
          {totals.rows.map((row) => (
            <PlanOutsideRow
              key={row.key}
              name={t(rowNames[row.key])}
              to={rowLinks[row.key]}
              onOpen={row.key === "installments" ? handleOpen : undefined}
              amount={row.amount}
              format={format}
            />
          ))}
          {unassigned !== undefined && (
            <PlanOutsideRow
              name={t("plan.unassigned")}
              amount={unassigned}
              format={format}
            />
          )}
        </TableBody>
      </TableContent>

      {open && (
        <InstallmentsDrawer
          items={installments}
          total={installmentsTotal}
          month={month}
          format={format}
          onClose={handleClose}
        />
      )}
    </Table>
  );
}
