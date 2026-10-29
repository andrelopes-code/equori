import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// A default account closed since it was chosen is no longer one a line may take.
export function openDefaultAccount(
  id: string | null,
  accountsById: Map<string, Account>,
): string | null {
  return id !== null &&
    accountsById.get(id)?.closed_on === undefined &&
    accountsById.has(id)
    ? id
    : null;
}
