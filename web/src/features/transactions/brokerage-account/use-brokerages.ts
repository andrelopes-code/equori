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
  // The open accounts of the brokerage in the base currency that hold no security.
  cash: Account[];
  // The cash account when the brokerage has exactly one.
  cashAccount?: Account;
  // The open accounts of the brokerage that hold a security.
  holdings: Account[];
  // The holding of the chosen instrument.
  held?: Account;
  // False when a brokerage is chosen and has no cash account in the base currency.
  baseCash: boolean;
}

// The brokerages a trade or an income may name, and what the chosen one holds (BC5, BC6).
export function useBrokerages(
  brokerageId: string | null,
  instrument: string | null,
): BrokerageState {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api)).data;
  const instruments = useQuery(instrumentsQuery(api)).data?.items;
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  return useMemo(
    () =>
      brokerageState(
        accounts ?? [],
        new Map((instruments ?? []).map((i) => [i.code, i.type])),
        base,
        brokerageId,
        instrument,
      ),
    [accounts, instruments, base, brokerageId, instrument],
  );
}

export function brokerageState(
  accounts: readonly Account[],
  types: ReadonlyMap<string, string>,
  base: string | undefined,
  brokerageId: string | null,
  instrument: string | null,
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
  const isSecurity = (a: Account) => {
    const type = types.get(a.currency);
    return type !== undefined && type !== "currency";
  };
  const cash = children.filter(
    (a) => a.class === "asset" && a.currency === base && !isSecurity(a),
  );
  const holdings = children.filter(isSecurity);

  return {
    brokerages,
    ...(brokerage === undefined ? {} : { brokerage }),
    cash,
    ...(cash.length === 1 && cash[0] !== undefined
      ? { cashAccount: cash[0] }
      : {}),
    holdings,
    ...heldOf(holdings, instrument),
    baseCash: brokerage === undefined || cash.length > 0,
  };
}

function heldOf(holdings: readonly Account[], instrument: string | null) {
  const held = holdings.find((a) => a.currency === instrument);
  return held === undefined ? {} : { held };
}
