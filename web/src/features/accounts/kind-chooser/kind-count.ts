import type { components } from "@/api/schema.gen";
import { kindOrder } from "@/features/accounts/kind-chooser/kind-order";
import type { Kind } from "@/features/accounts/model/account-kinds";

type Account = components["schemas"]["Account"];

// KC6: the open accounts of a kind; the cash line and the positions of a brokerage are its
// children (BC2) and do not count.
export function kindCount(accounts: readonly Account[], kind: Kind): number {
  return accounts.filter(
    (a) =>
      a.kind === kind &&
      a.closed_on === undefined &&
      (kind !== "brokerage" || a.parent_id === undefined),
  ).length;
}

export function kindCounts(accounts: readonly Account[]): Record<Kind, number> {
  return Object.fromEntries(
    kindOrder.map((kind) => [kind, kindCount(accounts, kind)]),
  ) as Record<Kind, number>;
}
