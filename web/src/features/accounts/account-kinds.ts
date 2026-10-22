import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type Account = components["schemas"]["Account"];
export type Kind = NonNullable<Account["kind"]>;
export type KindGroup = "accounts" | "cards" | "reserves" | "debts";

export const kinds: readonly Kind[] = [
  "checking",
  "savings",
  "cash",
  "wallet",
  "benefit",
  "reserve",
  "brokerage",
  "receivable",
  "credit_card",
  "loan",
  "payable",
];

// The groups of the kind chooser; a kind belongs to exactly one.
export const kindGroups: readonly { key: KindGroup; kinds: readonly Kind[] }[] =
  [
    { key: "accounts", kinds: ["checking", "cash", "wallet", "benefit"] },
    { key: "cards", kinds: ["credit_card"] },
    { key: "reserves", kinds: ["savings", "reserve", "brokerage"] },
    { key: "debts", kinds: ["loan", "payable", "receivable"] },
  ];

const liabilities = new Set<Kind>(["credit_card", "loan", "payable"]);

export function classOf(kind: Kind): "asset" | "liability" {
  return liabilities.has(kind) ? "liability" : "asset";
}

export const kindLabel: Record<Kind, MessageKey> = {
  checking: "kind.checking",
  savings: "kind.savings",
  cash: "kind.cash",
  wallet: "kind.wallet",
  benefit: "kind.benefit",
  reserve: "kind.reserve",
  brokerage: "kind.brokerage",
  receivable: "kind.receivable",
  credit_card: "kind.credit_card",
  loan: "kind.loan",
  payable: "kind.payable",
};

export const kindHint: Record<Kind, MessageKey> = {
  checking: "kind.hint.checking",
  savings: "kind.hint.savings",
  cash: "kind.hint.cash",
  wallet: "kind.hint.wallet",
  benefit: "kind.hint.benefit",
  reserve: "kind.hint.reserve",
  brokerage: "kind.hint.brokerage",
  receivable: "kind.hint.receivable",
  credit_card: "kind.hint.credit_card",
  loan: "kind.hint.loan",
  payable: "kind.hint.payable",
};

export const kindGroupLabel: Record<KindGroup, MessageKey> = {
  accounts: "kind.group.accounts",
  cards: "kind.group.cards",
  reserves: "kind.group.reserves",
  debts: "kind.group.debts",
};

// P6 amendment A35: the ledger kinds an aggregator's account subtype may feed.
const kindsOfSubtype: Record<string, readonly Kind[]> = {
  CHECKING_ACCOUNT: ["checking"],
  SAVINGS_ACCOUNT: ["savings", "reserve"],
  CREDIT_CARD: ["credit_card"],
  RESERVED_BALANCE: ["reserve"],
};

export function compatibleKinds(subtype: string): readonly Kind[] {
  return kindsOfSubtype[subtype] ?? [];
}

export function yieldCapable(kind: Kind): boolean {
  return kind === "savings" || kind === "reserve";
}

export const kindTitle: Record<Kind, MessageKey> = {
  checking: "kind.title.checking",
  savings: "kind.title.savings",
  cash: "kind.title.cash",
  wallet: "kind.title.wallet",
  benefit: "kind.title.benefit",
  reserve: "kind.title.reserve",
  brokerage: "kind.title.brokerage",
  receivable: "kind.title.receivable",
  credit_card: "kind.title.credit_card",
  loan: "kind.title.loan",
  payable: "kind.title.payable",
};
