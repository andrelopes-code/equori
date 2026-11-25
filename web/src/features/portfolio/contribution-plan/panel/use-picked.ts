import { useState } from "react";

// A choice that shows at the press, before its save: it goes back to the saved value when the save
// ends, so a refused one is not kept.
export function usePicked<T>(saved: T, pending: boolean) {
  const [picked, setPicked] = useState<{ value: T }>();
  const [waited, setWaited] = useState(pending);

  if (waited !== pending) {
    setWaited(pending);
    if (!pending) setPicked(undefined);
  }

  return {
    value: picked === undefined ? saved : picked.value,
    pick: (value: T) => {
      setPicked({ value });
    },
  };
}
