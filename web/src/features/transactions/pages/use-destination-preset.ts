import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { components } from "@/api/schema.gen";
import type { EntryDraft } from "@/features/transactions/entry-model/entry-kind";

type Account = components["schemas"]["Account"];

// The destination a link presets: set once, when the accounts load, and only for an account that
// exists and is open.
export function useDestinationPreset(
  toAccountId: string | undefined,
  accounts: Account[] | undefined,
  setDraft: Dispatch<SetStateAction<EntryDraft>>,
) {
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || toAccountId === undefined || accounts === undefined)
      return;
    applied.current = true;
    const target = accounts.find((a) => a.id === toAccountId);
    if (target === undefined || target.closed_on !== undefined) return;
    setDraft((draft) => ({ ...draft, toAccountId }));
  }, [toAccountId, accounts, setDraft]);
}
