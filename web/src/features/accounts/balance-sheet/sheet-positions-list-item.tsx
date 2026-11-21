import { Glyph, Icon } from "@slotted/react/icon";
import {
  ListItem,
  ListItemBody,
  ListItemButton,
  ListItemDescription,
  ListItemLabel,
  ListItemStart,
} from "@slotted/react/list-item";

import styles from "@/features/accounts/balance-sheet/balance-sheet.module.css";
import { listRailClass } from "@/features/accounts/balance-sheet/rail-class";
import type { SheetLine } from "@/features/accounts/balance-sheet/sheet-lines";
import { useT } from "@/i18n/i18n-provider";

type PositionsLine = Extract<SheetLine, { type: "positions" }>;

interface SheetPositionsListItemProps {
  line: PositionsLine;
  parentName: string;
  onToggle: (parentId: string) => void;
}

// The positions of a parent on a phone: one row that opens or folds them, with the codes of the
// first ones on its second line (AL9, AL12). The codes cut before the count of the others, which
// stays whole, so the line holds one row (spec 2026-11-21-mobile-accounts, MA2).
export function SheetPositionsListItem({
  line,
  parentName,
  onToggle,
}: SheetPositionsListItemProps) {
  const t = useT();
  const more = line.count - line.codes.length;

  return (
    <ListItem className={listRailClass(true, line.first, line.last)}>
      <ListItemButton
        aria-expanded={line.open}
        aria-label={t(
          line.open
            ? "balanceSheet.collapsePositions"
            : "balanceSheet.expandPositions",
          { name: parentName },
        )}
        onClick={() => {
          onToggle(line.parentId);
        }}
      >
        <ListItemStart>
          <Icon size="sm">
            <Glyph name={line.open ? "chevron-down" : "chevron-right"} />
          </Icon>
        </ListItemStart>
        <ListItemBody>
          <ListItemLabel>
            {t(
              line.count === 1
                ? "balanceSheet.positionsOne"
                : "balanceSheet.positions",
              { count: line.count },
            )}
          </ListItemLabel>
          {!line.open && (
            <ListItemDescription>
              <span className={styles.codes}>
                <span className={styles.codesCut}>
                  {line.codes.join(" · ")}
                </span>
                {more > 0 &&
                  ` · ${t("balanceSheet.morePositions", { count: more })}`}
              </span>
            </ListItemDescription>
          )}
        </ListItemBody>
      </ListItemButton>
    </ListItem>
  );
}
