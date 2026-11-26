import { Button } from "@slotted/react/button";
import { Link } from "@slotted/react/link";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import type { LinkOptions } from "@tanstack/react-router";

import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface PlanOutsideRowProps {
  name: string;
  // The screen that plans the figure; the name is a link to it.
  to?: LinkOptions["to"];
  // Opens what the figure is made of; the name is a button that calls it.
  onOpen?: (() => void) | undefined;
  amount: number;
  format: PlanFormat;
}

// A figure of the plan that no bucket takes, on one line of the split table: it has no share
// and no target, only its amount (planning coherence A258).
export function PlanOutsideRow({
  name,
  to,
  onOpen,
  amount,
  format,
}: PlanOutsideRowProps) {
  const t = useT();
  const dash = t("plan.dash");

  return (
    <TableRow>
      <TableRowHeader>
        {to === undefined && onOpen === undefined && (
          <Text size="sm" weight="medium">
            {name}
          </Text>
        )}
        {onOpen !== undefined && (
          <Text size="sm" weight="medium">
            <Button inline onClick={onOpen}>
              {name}
            </Button>
          </Text>
        )}
        {to !== undefined && (
          <Text size="sm" weight="medium">
            <Link render={routeTo({ to })}>{name}</Link>
          </Text>
        )}
      </TableRowHeader>
      <TableCell numeric>{dash}</TableCell>
      <TableCell numeric>{dash}</TableCell>
      <TableCell numeric>{format.money(amount)}</TableCell>
      <TableCell numeric>{dash}</TableCell>
    </TableRow>
  );
}
