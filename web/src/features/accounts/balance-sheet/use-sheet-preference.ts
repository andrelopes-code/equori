import { useState } from "react";

import {
  readSheetPreference,
  writeSheetPreference,
  type SheetPreference,
} from "@/features/accounts/balance-sheet/sheet-preference";

// The remembered grouping and order, read once per visit, and the setter that remembers a new one.
export function useSheetPreference(): [
  SheetPreference,
  (next: SheetPreference) => void,
] {
  const [preference, setPreference] = useState(readSheetPreference);

  function change(next: SheetPreference) {
    setPreference(next);
    writeSheetPreference(next);
  }

  return [preference, change];
}
