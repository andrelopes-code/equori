import type { components } from "@/api/schema.gen";
import { BalanceGroupList } from "@/features/accounts/balance-sheet/balance-group-list";
import { BalanceGroupTable } from "@/features/accounts/balance-sheet/balance-group-table";
import styles from "@/features/accounts/balance-sheet/balance-sheet.module.css";
import { SheetGroupsPlaceholder } from "@/features/accounts/balance-sheet/sheet-groups-placeholder";
import type { SheetSection } from "@/features/accounts/balance-sheet/sheet-layout";
import { sectionLabel } from "@/features/accounts/balance-sheet/sheet-section-label";
import { useSheetView } from "@/features/accounts/balance-sheet/use-sheet-view";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";
import { usePageWide } from "@/ui/runtime/use-page-wide";

type Institution = components["schemas"]["Institution"];

interface SheetGroupsProps {
  // Undefined while the balances load.
  sections: readonly SheetSection[] | undefined;
  institutions: Map<string, Institution>;
  showInstitution: boolean;
  date: string;
  // Null while the instruments load.
  scale: ((code: string) => number) | null;
}

// The groups of the balance sheet, as tables on a wide page and as lists otherwise.
export function SheetGroups({
  sections,
  institutions,
  showInstitution,
  date,
  scale,
}: SheetGroupsProps) {
  const t = useT();
  const compact = useMediaQuery(compactQuery);
  const pageWide = usePageWide();
  const sheetView = useSheetView();

  if (sections === undefined || scale === null) {
    return <SheetGroupsPlaceholder />;
  }

  return (
    <div className={styles.groups}>
      {sections.map((section) => {
        const props = {
          section,
          label: sectionLabel(section, institutions, t),
          view: sheetView.view,
          institutions,
          showInstitution,
          date,
          scale,
          onToggleParent: sheetView.toggleParent,
          onTogglePositions: sheetView.togglePositions,
        };
        return compact || !pageWide ? (
          <BalanceGroupList key={section.key} {...props} />
        ) : (
          <BalanceGroupTable key={section.key} {...props} />
        );
      })}
    </div>
  );
}
