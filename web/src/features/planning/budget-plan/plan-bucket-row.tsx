import { Inline } from "@slotted/react/inline";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import { bucketStatus } from "@/features/planning/budget-plan/bucket-figures";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

interface PlanBucketRowProps {
  name: string;
  withSavings: boolean;
  // The share as a percentage; undefined for the categories outside the split.
  share: string | undefined;
  target: number | undefined;
  planned: number;
  spent: number;
  format: PlanFormat;
}

// A bucket's figures on one line; the status says in words what is left or how far it is
// over, in the danger tone when over.
export function PlanBucketRow({
  name,
  withSavings,
  share,
  target,
  planned,
  spent,
  format,
}: PlanBucketRowProps) {
  const t = useT();
  const status = bucketStatus(target, planned, spent);
  const dash = t("plan.dash");

  return (
    <TableRow>
      <TableRowHeader>
        <Inline gap={4} align="center">
          <Text size="sm" weight="medium">
            {name}
          </Text>
          {withSavings && (
            <Text size="sm" tone="muted">
              {t("buckets.withSavings")}
            </Text>
          )}
        </Inline>
      </TableRowHeader>
      <TableCell numeric>{share ?? dash}</TableCell>
      <TableCell numeric>
        {target === undefined ? dash : format.money(target)}
      </TableCell>
      <TableCell numeric>{format.money(planned)}</TableCell>
      <TableCell numeric>{format.money(spent)}</TableCell>
      <TableCell numeric>
        {status === undefined && dash}
        {status?.kind === "left" && (
          <Text size="sm">
            {t("buckets.left", { amount: format.money(status.amount) })}
          </Text>
        )}
        {status?.kind === "over" && (
          <Text size="sm" tone="danger">
            {t("buckets.overBy", { amount: format.money(status.amount) })}
          </Text>
        )}
      </TableCell>
    </TableRow>
  );
}
