import { describe, expect, it } from "vitest";

import { linkCandidates } from "@/features/accounts/link-candidates";

const base = {
  currency: "BRL",
  opened_on: "2026-01-01",
  yield_mode: "none" as const,
};
const accounts = [
  {
    ...base,
    id: "res",
    name: "Reserva",
    class: "asset" as const,
    kind: "reserve" as const,
  },
  {
    ...base,
    id: "sav",
    name: "Poupança",
    class: "asset" as const,
    kind: "savings" as const,
  },
  {
    ...base,
    id: "usd",
    name: "Reserva USD",
    class: "asset" as const,
    kind: "reserve" as const,
    currency: "USD",
  },
  {
    ...base,
    id: "fed",
    name: "Caixinha",
    class: "asset" as const,
    kind: "reserve" as const,
  },
  {
    ...base,
    id: "par",
    name: "Reservas",
    class: "asset" as const,
    kind: "reserve" as const,
  },
  {
    ...base,
    id: "kid",
    name: "Filha",
    class: "asset" as const,
    kind: "reserve" as const,
    parent_id: "par",
  },
  {
    ...base,
    id: "old",
    name: "Antiga",
    class: "asset" as const,
    kind: "reserve" as const,
    closed_on: "2026-01-31",
  },
  {
    ...base,
    id: "chk",
    name: "Corrente",
    class: "asset" as const,
    kind: "checking" as const,
  },
];

function external(subtype: string) {
  return {
    id: "e",
    type: "BANK",
    subtype,
    name: "x",
    currency: "BRL",
    state: "pending" as const,
  };
}

describe("linkCandidates", () => {
  it("offers open leaf accounts of the currency and a compatible kind that nothing else feeds", () => {
    expect(
      linkCandidates(
        external("RESERVED_BALANCE"),
        accounts,
        new Set(["fed"]),
        "pt-BR",
      ).map((a) => a.id),
    ).toEqual(["kid", "res"]);
    expect(
      linkCandidates(
        external("SAVINGS_ACCOUNT"),
        accounts,
        new Set(["fed"]),
        "pt-BR",
      ).map((a) => a.id),
    ).toEqual(["kid", "sav", "res"]);
  });

  it("offers nothing for a subtype the ledger has no kind for", () => {
    expect(
      linkCandidates(external("INVESTMENT"), accounts, new Set(), "pt-BR"),
    ).toEqual([]);
  });
});
