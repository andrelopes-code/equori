import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  groupAccounts,
  pickable,
} from "@/features/transactions/account-groups";

type Account = components["schemas"]["Account"];

function account(
  name: string,
  kind: Account["kind"],
  extra: Partial<Account> = {},
): Account {
  return {
    id: name,
    name,
    class: kind === "credit_card" || kind === "loan" ? "liability" : "asset",
    ...(kind === undefined ? {} : { kind }),
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...extra,
  };
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

describe("groupAccounts", () => {
  it("keeps the fixed group order and sorts by name inside a group", () => {
    const groups = groupAccounts(
      [
        account("Caixinha viagem", "reserve"),
        account("Visa", "credit_card"),
        account("Nubank", "checking"),
        account("Carteira", "cash"),
        account("CDB", "savings"),
        account("Corretora", "brokerage"),
        account("Empréstimo", "loan"),
        account("Sem tipo", undefined),
      ],
      collator,
    );
    expect(groups.map((g) => [g.group, g.accounts.map((a) => a.name)])).toEqual(
      [
        ["accounts", ["Carteira", "Empréstimo", "Nubank", "Sem tipo"]],
        ["cards", ["Visa"]],
        ["reserves", ["Caixinha viagem", "CDB", "Corretora"]],
      ],
    );
  });

  it("omits an empty group", () => {
    expect(
      groupAccounts([account("Visa", "credit_card")], collator).map(
        (g) => g.group,
      ),
    ).toEqual(["cards"]);
  });
});

describe("pickable", () => {
  it("keeps open balance accounts, the chosen closed one, and drops the excluded one", () => {
    const accounts = [
      account("Nubank", "checking"),
      account("Old", "checking", { closed_on: "2026-05-01" }),
      account("Gone", "checking", { closed_on: "2026-05-01" }),
      account("Food", undefined, { class: "expense" }),
      account("Opening", undefined, {
        class: "equity",
        system_role: "opening",
      }),
      account("Visa", "credit_card"),
    ];
    expect(pickable(accounts, "Old", "Visa").map((a) => a.name)).toEqual([
      "Nubank",
      "Old",
    ]);
  });

  it("drops a parent account: postings go to its sub-accounts", () => {
    const accounts = [
      account("Nubank", "checking"),
      account("Nubank conta", "checking", { parent_id: "Nubank" }),
      account("Caixinha", "reserve", { parent_id: "Nubank" }),
    ];
    expect(pickable(accounts, null, null).map((a) => a.name)).toEqual([
      "Nubank conta",
      "Caixinha",
    ]);
  });
});
