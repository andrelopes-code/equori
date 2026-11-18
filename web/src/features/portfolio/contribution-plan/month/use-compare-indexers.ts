import { useState } from "react";

import { useComparableIndexes } from "@/features/calculators";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";

// The entry whose comparison is open. onCompare is undefined when no index of the currency has
// an expected path: the rows then draw no button.
export function useCompareIndexers(currency: string): {
  opened: ShoppingEntry | undefined;
  onCompare: ((entry: ShoppingEntry) => void) | undefined;
  close: () => void;
} {
  const offered = useComparableIndexes(currency).length > 0;
  const [opened, setOpened] = useState<ShoppingEntry>();

  return {
    opened,
    onCompare: offered ? setOpened : undefined,
    close: () => {
      setOpened(undefined);
    },
  };
}
