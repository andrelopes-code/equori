import { Section, SectionBody } from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import { SheetAccountRow } from "@/features/accounts/balance-sheet/sheet-account-row";
import styles from "@/features/accounts/balance-sheet/balance-sheet.module.css";
import { SheetShareBar } from "@/features/accounts/balance-sheet/sheet-share-bar";
import { SheetGroupHeader } from "@/features/accounts/balance-sheet/sheet-group-header";
import type { SheetGroupProps } from "@/features/accounts/balance-sheet/sheet-group-props";
import { sheetLines } from "@/features/accounts/balance-sheet/sheet-lines";
import { SheetPositionsRow } from "@/features/accounts/balance-sheet/sheet-positions-row";
import { institutionNote } from "@/features/accounts/balance-sheet/institution-note";
import { useMeasuredTops } from "@/features/portfolio";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// A group of the list holds a household's accounts: a bounded set, so a table (LP-14). Its
// title, share and total stand in the caption, a parent folds its children and the positions
// of a parent fold into one line.
export function BalanceGroupTable({
  section,
  label,
  view,
  institutions,
  showInstitution,
  date,
  scale,
  onToggleParent,
  onTogglePositions,
}: SheetGroupProps) {
  const t = useT();
  const measured = useMeasuredTops();
  const lines = sheetLines(section.rows, view);
  // The group shows the yield column when one of its accounts is measured (A208 R8).
  const yieldColumn = section.rows.some((row) => measured.has(row.account.id));
  const names = new Map(
    section.rows.map((row) => [row.account.id, row.account.name]),
  );

  return (
    <Section>
      <SheetGroupHeader
        label={label}
        total={section.total}
        scale={scale(section.total.currency)}
        share={section.share}
      />
      <SectionBody>
        <Stack gap={3}>
          {section.share !== undefined && (
            <SheetShareBar share={section.share} />
          )}
          <Table columns={yieldColumn ? 4 : 3} variant="framed">
            <TableContent
              aria-label={label}
              className={cx(styles.fixed, yieldColumn && styles.fixedYield)}
            >
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("balanceSheet.account")}
                  </TableColumnHeader>
                  <TableColumnHeader className={styles.statusColumn}>
                    {t("balanceSheet.status")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric className={styles.balanceColumn}>
                    {t("balanceSheet.balance")}
                  </TableColumnHeader>
                  {yieldColumn && (
                    <TableColumnHeader numeric className={styles.yieldColumn}>
                      {t("balanceSheet.yield")}
                    </TableColumnHeader>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line) =>
                  line.type === "positions" ? (
                    <SheetPositionsRow
                      key={`${line.parentId}:positions`}
                      line={line}
                      parentName={names.get(line.parentId) ?? ""}
                      yieldColumn={yieldColumn}
                      onToggle={onTogglePositions}
                    />
                  ) : (
                    <SheetAccountRow
                      key={line.row.account.id}
                      line={line}
                      institution={
                        showInstitution && line.row.depth === 0
                          ? institutionNote(line.row.account, institutions)
                          : undefined
                      }
                      date={date}
                      scale={scale}
                      yieldColumn={yieldColumn}
                      onToggle={onToggleParent}
                    />
                  ),
                )}
              </TableBody>
            </TableContent>
          </Table>
          {section.excluded > 0 && (
            <Text size="sm" tone="muted">
              {section.excluded === 1
                ? t("balanceSheet.excludedOne")
                : t("balanceSheet.excluded", { count: section.excluded })}
            </Text>
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
