import type { NavigateOptions } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// A card is read on the cards destination; every other account on its own record page.
export function accountRoute(
  account: Pick<Account, "id" | "kind">,
): NavigateOptions {
  return account.kind === "credit_card"
    ? { to: "/cards/$accountId", params: { accountId: account.id } }
    : { to: "/accounts/$id", params: { id: account.id } };
}

export function accountHref(account: Pick<Account, "id" | "kind">): string {
  return account.kind === "credit_card"
    ? `/cards/${account.id}`
    : `/accounts/${account.id}`;
}
