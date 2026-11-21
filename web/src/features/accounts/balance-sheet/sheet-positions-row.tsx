import { Inline } from "@slotted/react/inline";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import { railClass } from "@/features/accounts/balance-sheet/rail-class";
import styles from "@/features/accounts/balance-sheet/sheet-rail.module.css";
import type { SheetLine } from "@/features/accounts/balance-sheet/sheet-lines";
import { SheetToggle } from "@/features/accounts/balance-sheet/sheet-toggle";
import { useT } from "@/i18n/i18n-provider";

type PositionsLine = Extract<SheetLine, { type: "positions" }>;

interface SheetPositionsRowProps {
  line: PositionsLine;
  // The name of the parent the positions belong to.
  parentName: string;
  yieldColumn: boolean;
  onToggle: (parentId: string) => void;
}

// The positions of a parent, in a quantity and not in money, fold into one line: how many they
// are and the codes of the first ones (AL9).
export function SheetPositionsRow({
  line,
  parentName,
  yieldColumn,
  onToggle,
}: SheetPositionsRowProps) {
  const t = useT();
  const more = line.count - line.codes.length;

  return (
    <TableRow>
      <TableRowHeader className={railClass(true, line.first, line.last)}>
        <div className={styles.account}>
          <SheetToggle
            open={line.open}
            label={t(
              line.open
                ? "balanceSheet.collapsePositions"
                : "balanceSheet.expandPositions",
              { name: parentName },
            )}
            onToggle={() => {
              onToggle(line.parentId);
            }}
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
        </div>
      </TableRowHeader>
      <TableCell />
      <TableCell />
      {yieldColumn && <TableCell />}
    </TableRow>
  );
}
