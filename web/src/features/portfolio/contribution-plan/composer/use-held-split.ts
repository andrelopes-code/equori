import { useState } from "react";

// The split the bar draws: the latest one, and the previous one while a preview is pending.
export function useHeldSplit<T>(split: T[], pending: boolean): T[] {
  const key = JSON.stringify(split);
  const [held, setHeld] = useState({ key, split });
  if (!pending && held.key !== key) setHeld({ key, split });

  return pending ? held.split : split;
}
