import { useCallback, useState } from "react";

import { useKeyShortcut } from "@/app/shell/frame-state/use-entry";

export interface CalculatorOpen {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

// K1, K4: the key C and the commands open and close the calculator, in the wide layout only.
export function useCalculatorOpen(wide: boolean): CalculatorOpen {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    if (wide) setOpen((current) => !current);
  }, [wide]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useKeyShortcut("c", toggle);

  return { open: wide && open, toggle, close };
}
