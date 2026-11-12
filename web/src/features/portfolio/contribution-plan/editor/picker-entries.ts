import type { components } from "@/api/schema.gen";
import type { MemberRef } from "@/features/portfolio/contribution-plan/model/plan-edits";

type Account = components["schemas"]["Account"];
type Instrument = components["schemas"]["Instrument"];

export type PickerEntries = ReturnType<typeof pickerEntries>;

const kinds = new Set(["savings", "reserve", "brokerage"]);

// CN3: an open asset account of a kind that holds a balance, without children, in a currency; and
// every instrument of the catalog that is not a currency.
export function pickerEntries(
  accounts: readonly Account[],
  instruments: readonly Instrument[],
) {
  const currencies = new Set(
    instruments.filter((i) => i.type === "currency").map((i) => i.code),
  );
  const parents = new Set(accounts.map((a) => a.parent_id));

  return {
    accounts: accounts.filter(
      (a) =>
        a.class === "asset" &&
        a.kind !== undefined &&
        kinds.has(a.kind) &&
        !parents.has(a.id) &&
        currencies.has(a.currency) &&
        a.closed_on === undefined,
    ),
    instruments: instruments.filter((i) => i.type !== "currency"),
  };
}

// Keeps the entries whose name or code holds the query, ignoring case and accents. The code of an
// account is its instrument.
export function filterPickerEntries(
  entries: PickerEntries,
  query: string,
): PickerEntries {
  const needle = fold(query);
  if (needle === "") return entries;

  const matches = (name: string, code: string) =>
    fold(name).includes(needle) || fold(code).includes(needle);

  return {
    accounts: entries.accounts.filter((a) => matches(a.name, a.currency)),
    instruments: entries.instruments.filter((i) => matches(i.name, i.code)),
  };
}

export function memberKey(ref: MemberRef): string {
  return ref.accountId === undefined
    ? `instrument:${ref.instrument ?? ""}`
    : `account:${ref.accountId}`;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}
