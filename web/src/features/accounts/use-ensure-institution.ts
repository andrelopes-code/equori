import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { useApi } from "@/api/api-context";
import type { AccountDraft } from "@/features/accounts/account-draft";
import { institutionsQuery, useCreateInstitution } from "@/features/setup";

// The institution an account is saved with. A pending institution is created first, once per
// choice, so the accounts of one start row share it. An owned institution with the same name is
// reused: the book refuses two institutions whose names differ only in case.
export function useEnsureInstitution() {
  const api = useApi();
  const queryClient = useQueryClient();
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

    const owned = await queryClient.query(institutionsQuery(api));
    const same = owned.find(
      (i) => i.name.toLocaleLowerCase() === pending.name.toLocaleLowerCase(),
    );
    const id = same?.id ?? (await create.mutateAsync(pending)).id;
    made.current.set(key, id);

    return id;
  };
}
