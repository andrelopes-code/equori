import { List } from "@slotted/react/list";
import { Section, SectionBody } from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { institutionNote } from "@/features/accounts/balance-sheet/institution-note";
import { SheetAccountListItem } from "@/features/accounts/balance-sheet/sheet-account-list-item";
import { SheetGroupHeader } from "@/features/accounts/balance-sheet/sheet-group-header";
import type { SheetGroupProps } from "@/features/accounts/balance-sheet/sheet-group-props";
import { sheetLines } from "@/features/accounts/balance-sheet/sheet-lines";
import { SheetPositionsListItem } from "@/features/accounts/balance-sheet/sheet-positions-list-item";
import { SheetShareBar } from "@/features/accounts/balance-sheet/sheet-share-bar";
import { useT } from "@/i18n/i18n-provider";

// Below 600 px a group is a list of rows that open the account (LP-01), with the hierarchy
// drawn as on a desktop. A parent stays open; only the positions fold (AL12).
export function BalanceGroupList({
  section,
  label,
  view,
  institutions,
  showInstitution,
  date,
  scale,
  onTogglePositions,
}: SheetGroupProps) {
  const t = useT();
  const lines = sheetLines(section.rows, {
    closed: new Set(),
    positionsOpen: view.positionsOpen,
  });
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
        shareOf={section.shareOf}
      />
      <SectionBody>
        <Stack gap={3}>
          {section.share !== undefined && (
            <SheetShareBar share={section.share} />
          )}
          <List aria-label={label} variant="framed">
            {lines.map((line) =>
              line.type === "positions" ? (
                <SheetPositionsListItem
                  key={`${line.parentId}:positions`}
                  line={line}
                  parentName={names.get(line.parentId) ?? ""}
                  onToggle={onTogglePositions}
                />
              ) : (
                <SheetAccountListItem
                  key={line.row.account.id}
                  line={line}
                  institution={
                    showInstitution && line.row.depth === 0
                      ? institutionNote(line.row.account, institutions)
                      : undefined
                  }
                  date={date}
                  scale={scale}
                />
              ),
            )}
          </List>
          {section.excluded > 0 && (
            <Text size="sm" tone="muted">
              {t("balanceSheet.excluded", { count: section.excluded })}
            </Text>
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
