import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Instrument = components["schemas"]["Instrument"];

// BC10: a leaf `brokerage` account in a currency whose name is the code of a known instrument.
// It holds cash; the name suggests a holding, which a purchase creates.
export function isCashLeafNamedAfterInstrument(
  account: Account,
  accounts: readonly Account[],
  instruments: readonly Instrument[],
): boolean {
  if (account.kind !== "brokerage") return false;
  if (accounts.some((a) => a.parent_id === account.id)) return false;

  const isCurrency = instruments.some(
    (i) => i.code === account.currency && i.type === "currency",
  );

  return isCurrency && instruments.some((i) => i.code === account.name);
}
