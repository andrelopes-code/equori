import { SheetSegments } from "@/features/accounts/balance-sheet/sheet-segments";
import { SheetSelects } from "@/features/accounts/balance-sheet/sheet-selects";
import type {
  GroupBy,
  Order,
} from "@/features/accounts/balance-sheet/sheet-layout";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

interface SheetControlsProps {
  group: GroupBy;
  order: Order;
  onGroupChange: (group: GroupBy) => void;
  onOrderChange: (order: Order) => void;
}

// Segmented controls from 600 px, selects below it.
export function SheetControls(props: SheetControlsProps) {
  const compact = useMediaQuery(compactQuery);

  return compact ? <SheetSelects {...props} /> : <SheetSegments {...props} />;
}
