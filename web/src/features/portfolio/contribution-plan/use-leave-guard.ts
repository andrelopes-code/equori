import { useBlocker } from "@tanstack/react-router";
import { useState } from "react";

// A navigation over unsaved targets waits on the reader's answer: true keeps the page.
export function useLeaveGuard(dirty: boolean) {
  const [asking, setAsking] = useState<((block: boolean) => void) | null>(null);

  useBlocker({
    shouldBlockFn: () =>
      dirty
        ? new Promise<boolean>((resolve) => {
            setAsking(() => resolve);
          })
        : false,
    enableBeforeUnload: () => dirty,
  });

  function answer(block: boolean) {
    asking?.(block);
    setAsking(null);
  }

  return { asking: asking !== null, answer };
}
