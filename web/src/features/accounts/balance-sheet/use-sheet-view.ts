import { useMemo, useState } from "react";

import type { SheetView } from "@/features/accounts/balance-sheet/sheet-lines";

function toggled(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// What the reader folded or opened on the list; every parent starts open and every positions
// line starts folded. It is kept for the visit, not for the address.
export function useSheetView() {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [positionsOpen, setPositionsOpen] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const view = useMemo<SheetView>(
    () => ({ closed, positionsOpen }),
    [closed, positionsOpen],
  );

  return {
    view,
    toggleParent: (id: string) => {
      setClosed((prev) => toggled(prev, id));
    },
    togglePositions: (id: string) => {
      setPositionsOpen((prev) => toggled(prev, id));
    },
  };
}
