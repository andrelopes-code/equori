import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

export type CashMode = "institution" | "own";

// BC16: the money stays in the institution's own account when an open asset account of the
// base currency, outside every brokerage, can pay from it.
export function defaultCashMode(
  accounts: readonly Account[],
  institutionId: string | null,
  base: string,
): CashMode {
  if (institutionId === null) return "own";
  const brokerages = new Set(
    accounts.filter((a) => a.kind === "brokerage").map((a) => a.id),
  );
  const pays = accounts.some(
    (a) =>
      a.institution_id === institutionId &&
      a.class === "asset" &&
      a.currency === base &&
      a.closed_on === undefined &&
      a.kind !== "brokerage" &&
      !(a.parent_id !== undefined && brokerages.has(a.parent_id)),
  );
  return pays ? "institution" : "own";
}
