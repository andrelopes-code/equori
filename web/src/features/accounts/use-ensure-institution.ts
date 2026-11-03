import { useRef } from "react";

import type { AccountDraft } from "@/features/accounts/account-draft";
import { useCreateInstitution } from "@/features/setup";

// The institution an account is saved with. A pending institution is created first, once per
// choice, so the accounts of one start row share it.
export function useEnsureInstitution() {
  const create = useCreateInstitution();
  const made = useRef(new Map<string, string>());

  return async (
    draft: Pick<AccountDraft, "institutionId" | "pendingInstitution">,
  ): Promise<string | null> => {
    const pending = draft.pendingInstitution;
    if (pending === null) return draft.institutionId;

    const key = JSON.stringify(pending);
    const known = made.current.get(key);
    if (known !== undefined) return known;

    const institution = await create.mutateAsync(pending);
    made.current.set(key, institution.id);

    return institution.id;
  };
}
