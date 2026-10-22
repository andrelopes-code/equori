import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  balancesQuery,
  logoIndexQuery,
  logoOf,
  shapeOf,
} from "@/features/accounts";
import type { AccountShape } from "@/features/accounts";
import { goalsQuery } from "@/features/planning";
import { institutionsQuery, payeesQuery } from "@/features/setup";
import {
  consequenceOf,
  unavailableReason,
} from "@/features/transactions/account-consequence";
import type { Consequence } from "@/features/transactions/account-consequence";
import { groupOf } from "@/features/transactions/account-groups";
import type { AccountGroup } from "@/features/transactions/account-groups";
import {
  suggestAccount,
  suggestionWindow,
} from "@/features/transactions/account-suggestion";
import {
  recentTransactionsQuery,
  statementPlacementQuery,
} from "@/features/transactions/api";

type Account = components["schemas"]["Account"];

// What the picker shows of one account: only facts the application holds; each one absent
// when its source has none.
export interface AccountChoice {
  account: Account;
  group: AccountGroup;
  shape: AccountShape;
  // The institution's name when the account has one: the monogram and the search read it.
  institution: string | undefined;
  logo: string | undefined;
  progress: number | undefined;
  balance: number | undefined;
  freeLimit: number | undefined;
  consequence: Consequence | null;
  unavailable: "noFreeLimit" | null;
}

export interface SuggestionView {
  accountId: string;
  count: number;
  total: number;
  name: string;
}

export function useAccountChoices({
  accounts,
  all,
  amount,
  direction,
  date,
  categoryId,
  payeeId,
}: {
  // The accounts offered.
  accounts: readonly Account[];
  // Every account of the user, which names the category of a suggestion.
  all: readonly Account[];
  amount: number;
  direction: "out" | "in";
  date: string;
  categoryId: string | null;
  payeeId: string | null;
}): { choices: AccountChoice[]; suggestion: SuggestionView | null } {
  const api = useApi();
  const balances = useQuery(balancesQuery(api, date, "booked"));
  const institutions = useQuery(institutionsQuery(api));
  const logos = useQuery(logoIndexQuery);
  const goals = useQuery(goalsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const cards = accounts.filter((a) => groupOf(a) === "cards");
  const placements = useQueries({
    queries: cards.map((card) => statementPlacementQuery(api, card.id, date)),
  });
  const placementOf = new Map(
    cards.map((card, i) => [card.id, placements[i]?.data ?? undefined]),
  );
  const filter =
    payeeId !== null
      ? { payee_id: payeeId }
      : categoryId !== null
        ? { account_id: categoryId }
        : null;
  const recent = useQuery({
    ...recentTransactionsQuery(
      api,
      filter ?? { account_id: "" },
      suggestionWindow,
    ),
    enabled: filter !== null,
  });

  const institutionOf = new Map(
    (institutions.data ?? []).map((i) => [i.id, i]),
  );
  const balanceOf = new Map(
    (balances.data ?? []).map((b) => [b.account_id, b.balance]),
  );
  // A ring measures one account only when the goal is that account's alone.
  const progressOf = new Map(
    (goals.data ?? [])
      .filter((g) => g.account_ids.length === 1)
      .map((g) => [g.account_ids[0], g.progress_bp]),
  );

  const choices = accounts.map((account): AccountChoice => {
    const institution =
      account.institution_id === undefined
        ? undefined
        : institutionOf.get(account.institution_id);
    const held = balanceOf.get(account.id);
    const balance =
      held?.currency === account.currency ? held.amount : undefined;
    const free = account.card?.available_limit;
    return {
      account,
      group: groupOf(account),
      shape: shapeOf(account.kind),
      institution: institution?.name,
      logo: logoOf(institution?.identifier, logos.data),
      progress: progressOf.get(account.id),
      balance,
      freeLimit: free?.currency === account.currency ? free.amount : undefined,
      consequence: consequenceOf({
        account,
        amount,
        direction,
        date,
        balance,
        placement: placementOf.get(account.id) ?? undefined,
      }),
      unavailable: unavailableReason(account, amount, direction),
    };
  });

  const found =
    filter === null || recent.data === undefined
      ? null
      : suggestAccount(recent.data, new Set(accounts.map((a) => a.id)));
  const sourceName =
    payeeId !== null
      ? payees.data?.find((p) => p.id === payeeId)?.name
      : all.find((a) => a.id === categoryId)?.name;
  const suggestion =
    found === null || sourceName === undefined
      ? null
      : { ...found, name: sourceName };
  return { choices, suggestion };
}
