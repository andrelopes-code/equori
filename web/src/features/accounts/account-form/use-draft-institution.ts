import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import {
  logoIndexQuery,
  logoOf,
} from "@/features/accounts/model/institution-logo";
import { institutionsQuery } from "@/features/setup";

// The institution the draft names, owned or still pending, and its logo.
export function useDraftInstitution(draft: AccountDraft) {
  const institutions = useQuery(institutionsQuery(useApi()));
  const index = useQuery(logoIndexQuery);
  const institution = institutions.data?.find(
    (i) => i.id === draft.institutionId,
  );
  const chosen = institution ?? draft.pendingInstitution;

  return { chosen, logo: logoOf(chosen?.identifier, index.data) };
}
