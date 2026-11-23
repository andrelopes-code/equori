import { useState } from "react";

import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";

// The entry whose report is open.
export function useReportDialog(): {
  opened: ShoppingEntry | undefined;
  onReport: (entry: ShoppingEntry) => void;
  close: () => void;
} {
  const [opened, setOpened] = useState<ShoppingEntry>();

  return {
    opened,
    onReport: setOpened,
    close: () => {
      setOpened(undefined);
    },
  };
}
