import type { components } from "@/api/schema.gen";
import type { SheetSection } from "@/features/accounts/balance-sheet/sheet-layout";
import type { SheetView } from "@/features/accounts/balance-sheet/sheet-lines";

type Institution = components["schemas"]["Institution"];

// What a group of the list, on a desktop or on a phone, is drawn from.
export interface SheetGroupProps {
  section: SheetSection;
  label: string;
  view: SheetView;
  institutions: Map<string, Institution>;
  // The group does not already say the institution, so each row writes it.
  showInstitution: boolean;
  date: string;
  scale: (code: string) => number;
  onToggleParent: (accountId: string) => void;
  onTogglePositions: (parentId: string) => void;
}
