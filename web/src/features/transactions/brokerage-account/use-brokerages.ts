import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { instrumentsQuery, settingsQuery } from "@/features/setup";

type Account = components["schemas"]["Account"];

export interface BrokerageState {
  brokerages: Account[];
  brokerage?: Account;
  // The accounts that may pay or receive a trade (BC13, BC14): the open Caixa children of the
  // brokerage and the open asset accounts of its institution outside its tree, in the base currency.
  payers: Account[];
  // The paying account when there is exactly one.
  payer?: Account;
  // The open accounts of the brokerage that hold a security.
  holdings: Account[];
  // The holding of the chosen instrument.
  held?: Account;
  // False when a brokerage is chosen and has no paying account.
  baseCash: boolean;
  // The quote currency of the chosen instrument (FC1).
  quote?: string;
}

// The brokerages a trade or an income may name, and what the chosen one holds (BC5, BC6). The
// payers also take the quote currency of each instrument in `quoted` (FC1).
export function useBrokerages(
  brokerageId: string | null,
  instrument: string | null,
  quoted: readonly (string | null)[] = [],
): BrokerageState {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api)).data;
  const instruments = useQuery(instrumentsQuery(api)).data?.items;
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const quotedKey = quoted.join(",");

  return useMemo(() => {
    const quotes = new Map(
      (instruments ?? []).map((i) => [i.code, i.quote_currency]),
    );
    const accepted = quotedKey
      .split(",")
      .flatMap((code) => quotes.get(code) ?? []);
    const quote = instrument === null ? undefined : quotes.get(instrument);

    return {
      ...brokerageState(
        accounts ?? [],
        new Map((instruments ?? []).map((i) => [i.code, i.type])),
        base,
        brokerageId,
        instrument,
        accepted,
      ),
      ...(quote === undefined ? {} : { quote }),
    };
  }, [accounts, instruments, base, brokerageId, instrument, quotedKey]);
}

export function brokerageState(
  accounts: readonly Account[],
  types: ReadonlyMap<string, string>,
  base: string | undefined,
  brokerageId: string | null,
  instrument: string | null,
  // Currencies other than the base that a paying account may hold (FC1).
  accepted: readonly string[] = [],
): BrokerageState {
  const kinds = new Map(accounts.map((a) => [a.id, a.kind]));
  const parents = new Set(accounts.map((a) => a.parent_id));
  const brokerages = accounts.filter(
    (a) =>
      a.kind === "brokerage" &&
      a.class === "asset" &&
      a.closed_on === undefined &&
      (a.parent_id === undefined || kinds.get(a.parent_id) !== "brokerage") &&
      parents.has(a.id),
  );
  const brokerage =
    brokerages.find((a) => a.id === brokerageId) ??
    (brokerageId === null && brokerages.length === 1
      ? brokerages[0]
      : undefined);
  const children = accounts.filter(
    (a) =>
      brokerage !== undefined &&
      a.parent_id === brokerage.id &&
      a.closed_on === undefined,
  );
  const paying = (currency: string) =>
    currency === base || accepted.includes(currency);
  const isSecurity = (a: Account) => {
    const type = types.get(a.currency);
    return type !== undefined && type !== "currency";
  };
  const cash = children.filter(
    (a) => a.class === "asset" && paying(a.currency) && !isSecurity(a),
  );
  const institutional = accounts.filter(
    (a) =>
      brokerage?.institution_id !== undefined &&
      a.institution_id === brokerage.institution_id &&
      a.id !== brokerage.id &&
      a.parent_id !== brokerage.id &&
      a.kind !== "brokerage" &&
      a.class === "asset" &&
      a.closed_on === undefined &&
      paying(a.currency) &&
      !isSecurity(a),
  );
  const payers = [...cash, ...institutional];
  const holdings = children.filter(isSecurity);

  return {
    brokerages,
    ...(brokerage === undefined ? {} : { brokerage }),
    payers,
    ...(payers.length === 1 && payers[0] !== undefined
      ? { payer: payers[0] }
      : {}),
    holdings,
    ...heldOf(holdings, instrument),
    baseCash: brokerage === undefined || payers.length > 0,
  };
}

function heldOf(holdings: readonly Account[], instrument: string | null) {
  const held = holdings.find((a) => a.currency === instrument);
  return held === undefined ? {} : { held };
}
