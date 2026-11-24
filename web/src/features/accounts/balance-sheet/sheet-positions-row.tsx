import { Inline } from "@slotted/react/inline";
import {
  TableCell,
  TableExpander,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { SheetLine } from "@/features/accounts/balance-sheet/sheet-lines";
import { lineKey } from "@/features/accounts/balance-sheet/sheet-lines";
import { useT } from "@/i18n/i18n-provider";

type PositionsLine = Extract<SheetLine, { type: "positions" }>;

interface SheetPositionsRowProps {
  line: PositionsLine;
  // The name of the parent the positions belong to.
  parentName: string;
  yieldColumn: boolean;
}

// The positions of a parent, in a quantity and not in money, fold into one line: how many they
// are and the codes of the first ones (AL9).
export function SheetPositionsRow({
  line,
  parentName,
  yieldColumn,
}: SheetPositionsRowProps) {
  const t = useT();
  const more = line.count - line.codes.length;

  return (
    <TableRow value={lineKey(line)} level={line.depth} parent={line.parentId}>
      <TableRowHeader>
        <TableExpander
          aria-label={t(
            line.open
              ? "balanceSheet.collapsePositions"
              : "balanceSheet.expandPositions",
            { name: parentName },
          )}
        />

        <Inline gap={4} wrap="nowrap" align="center">
          <Text size="sm" tone="muted" wrap="nowrap">
            {t(
              line.count === 1
                ? "balanceSheet.positionsOne"
                : "balanceSheet.positions",
              { count: line.count },
            )}
          </Text>
          {!line.open &&
            line.codes.map((code) => (
              <Tag key={code} size="sm" tone="secondary">
                {code}
              </Tag>
            ))}
          {!line.open && more > 0 && (
            <Text size="xs" tone="muted" wrap="nowrap">
              {t("balanceSheet.morePositions", { count: more })}
            </Text>
          )}
        </Inline>
      </TableRowHeader>
      <TableCell />
      <TableCell />
      {yieldColumn && <TableCell />}
    </TableRow>
  );
}
