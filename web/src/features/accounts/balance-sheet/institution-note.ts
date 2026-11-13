import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Institution = components["schemas"]["Institution"];

// The institution of an account to write under its name; none when the name already says it.
export function institutionNote(
  account: Pick<Account, "name" | "institution_id">,
  institutions: ReadonlyMap<string, Pick<Institution, "name">>,
): string | undefined {
  if (account.institution_id === undefined) return undefined;
  const name = institutions.get(account.institution_id)?.name;
  if (name === undefined) return undefined;
  return name.toLowerCase() === account.name.toLowerCase() ? undefined : name;
}
