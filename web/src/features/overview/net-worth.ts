import type { components } from "@/api/schema.gen";

type NetWorth = components["schemas"]["NetWorth"];

export interface NetWorthChange {
  // Minor units of the base currency.
  amount: number;
  // Change over the magnitude of the previous net; undefined when that net is zero.
  fraction: number | undefined;
}

export function changeOf(current: number, previous: number): NetWorthChange {
  const amount = current - previous;
  return {
    amount,
    fraction: previous === 0 ? undefined : amount / Math.abs(previous),
  };
}

export function netWorthChange(
  current: NetWorth,
  previous: NetWorth,
): NetWorthChange {
  return changeOf(current.net.amount, previous.net.amount);
}
