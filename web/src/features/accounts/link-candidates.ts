import type { components } from "@/api/schema.gen";
import { compatibleKinds } from "@/features/accounts/account-kinds";

type Account = components["schemas"]["Account"];
type ExternalAccount = components["schemas"]["ExternalAccount"];

// A35: an external account feeds an open leaf balance account of its currency and a compatible
// kind that no other external account feeds; the closest names come first.
export function linkCandidates(
  external: ExternalAccount,
  accounts: readonly Account[],
  fed: ReadonlySet<string>,
  locale: string,
): Account[] {
  const kinds = compatibleKinds(external.subtype);
  const parents = new Set(accounts.map((a) => a.parent_id));
  return accounts
    .filter(
      (a) =>
        a.kind !== undefined &&
        kinds.includes(a.kind) &&
        a.currency === external.currency &&
        a.closed_on === undefined &&
        a.system_role === undefined &&
        !parents.has(a.id) &&
        !fed.has(a.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
