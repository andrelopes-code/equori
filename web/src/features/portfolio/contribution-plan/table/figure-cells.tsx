import { TableCell } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import {
  formatShare,
  isPositive,
  noValue,
} from "@/features/portfolio/contribution-plan/table/figures";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface FigureCellsProps {
  target: number | undefined;
  current: number | undefined;
  after: number | undefined;
  amount: Money | undefined;
  // The units the amount buys, for a member with a unit value (CN16).
  units?: Money | undefined;
  // Replaces the target figure in edit mode.
  targetCell?: ReactNode;
}

// The four figures of a row, each on the end edge of its column. The amount is the heaviest text
// of the row; a zero amount is a muted dash. The units stand before the amount, so every amount
// ends on the same vertical line.
export function FigureCells({
  target,
  current,
  after,
  amount,
  units,
  targetCell,
}: FigureCellsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  return (
    <>
      <TableCell numeric text="nowrap">
        {targetCell ?? <Text tone="muted">{formatShare(tag, target)}</Text>}
      </TableCell>

      <TableCell numeric text="nowrap">
        {formatShare(tag, current)}
      </TableCell>

      <TableCell numeric text="nowrap">
        {formatShare(tag, after)}
      </TableCell>

      <TableCell numeric text="nowrap">
        {isPositive(units) && (
          <Text size="xs" tone="muted" className="me-4">
            {t("contributionPlan.quantity", { count: fmt.number(units, 0) })}
          </Text>
        )}

        {isPositive(amount) && (
          <Text weight="semibold">
            {fmt.money(amount, scale?.(amount.currency) ?? 0)}
          </Text>
        )}

        {!isPositive(amount) && <Text tone="muted">{noValue}</Text>}
      </TableCell>
    </>
  );
}
