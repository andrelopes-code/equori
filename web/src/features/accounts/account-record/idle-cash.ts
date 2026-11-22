import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Instrument = components["schemas"]["Instrument"];

export interface IdleCash {
  cash: Account;
  paying: Account;
}

// BC19: the one open cash account of a brokerage that holds a security, and the one account of
// its institution that pays its trades once that cash is closed (the candidates of BC14). Whether
// the cash has an entry is read by the caller.
export function idleCashCandidate(
  account: Account,
  accounts: readonly Account[],
  instruments: readonly Instrument[],
  base: string,
): IdleCash | null {
  if (account.kind !== "brokerage" || account.parent_id !== undefined) {
    return null;
  }

  if (account.institution_id === undefined) return null;

  const children = accounts.filter((a) => a.parent_id === account.id);
  const cashes = children.filter(
    (a) => a.currency === base && a.closed_on === undefined,
  );
  const paying = accounts.filter(
    (a) =>
      a.institution_id === account.institution_id &&
      a.class === "asset" &&
      a.currency === base &&
      a.closed_on === undefined &&
      a.kind !== "brokerage" &&
      a.parent_id !== account.id,
  );
  const [cash] = cashes;
  const [payer] = paying;

  if (cash === undefined || cashes.length > 1) return null;
  if (payer === undefined || paying.length > 1) return null;
  if (!children.some((a) => isSecurity(a.currency, instruments))) return null;

  return { cash, paying: payer };
}

function isSecurity(code: string, instruments: readonly Instrument[]) {
  return instruments.some((i) => i.code === code && i.type !== "currency");
}
