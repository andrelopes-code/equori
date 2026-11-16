import { useState } from "react";
import type { SyntheticEvent } from "react";

// A native disclosure whose content mounts when it first opens and stays mounted after. Rows of a
// folded region then cost nothing until the region is opened.
export function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open);

  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) setOpened(true);
  }

  return { opened: opened || open, onToggle: handleToggle };
}
