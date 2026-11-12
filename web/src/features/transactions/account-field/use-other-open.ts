import { useState } from "react";

// The state of the block "Other accounts": closed until the reader opens it, and open while
// `forced` holds (a search is active, or the chosen account sits in the block). A change of
// `forced` sets the state again; the reader's toggle holds in between.
export function useOtherOpen(forced: boolean) {
  const [open, setOpen] = useState(forced);
  const [seen, setSeen] = useState(forced);

  if (seen !== forced) {
    setSeen(forced);
    setOpen(forced);
  }

  return [open, setOpen] as const;
}
