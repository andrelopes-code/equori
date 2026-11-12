import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { shapeOf } from "@/features/accounts";
import type { Operation } from "@/features/transactions/account-field/account-operation";
import { sectionsOf } from "@/features/transactions/account-field/account-sections";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { groupOf } from "@/features/transactions/model/account-groups";

type Account = components["schemas"]["Account"];
type Layout = [string, string[]][];

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

const accounts: [string, string, NonNullable<Account["kind"]>][] = [
  ["rec", "A receber: Rafael", "receivable"],
  ["ale", "Alelo Refeição", "benefit"],
  ["car", "Carteira", "cash"],
  ["itauc", "Conta corrente Itaú", "checking"],
  ["nubc", "Conta Nubank", "checking"],
  ["itauv", "Itaú Visa Platinum", "credit_card"],
  ["numc", "Nubank Mastercard", "credit_card"],
  ["click", "Itaú Click virtual", "credit_card"],
  ["cx", "Caixinha reserva de emergência", "reserve"],
  ["btc", "mb BTCBRL", "brokerage"],
  ["pou", "Poupança Itaú", "savings"],
  ["xp", "Saldo em conta XP", "brokerage"],
];

describe("sectionsOf", () => {
  const cases: {
    name: string;
    operation: Operation;
    compact: boolean;
    suggestedId: string | null;
    want: Layout;
  }[] = [
    {
      name: "expense with a suggestion",
      operation: "expense",
      compact: false,
      suggestedId: "numc",
      want: [
        ["suggested", ["numc"]],
        ["leavesBalance", ["itauc", "nubc", "car", "ale"]],
        ["goesToStatement", ["click", "itauv"]],
        ["other", ["rec", "cx", "btc", "pou", "xp"]],
      ],
    },
    {
      name: "income with a suggestion",
      operation: "income",
      compact: false,
      suggestedId: "itauc",
      want: [
        ["suggested", ["itauc"]],
        ["entersBalance", ["nubc", "pou", "car", "ale"]],
        ["other", ["rec", "cx", "click", "itauv", "btc", "numc", "xp"]],
      ],
    },
    {
      name: "transfer-in without a suggestion",
      operation: "transfer-in",
      compact: false,
      suggestedId: null,
      want: [
        [
          "entersBalance",
          ["itauc", "nubc", "pou", "car", "ale", "cx", "btc", "xp"],
        ],
        ["settlesStatement", ["click", "itauv", "numc"]],
        ["other", ["rec"]],
      ],
    },
    {
      name: "compact expense without a suggestion",
      operation: "expense",
      compact: true,
      suggestedId: null,
      want: [
        ["accounts", ["itauc", "nubc", "car", "ale"]],
        ["cards", ["click", "itauv", "numc"]],
        ["other", ["rec", "cx", "btc", "pou", "xp"]],
      ],
    },
    {
      name: "a suggested id absent from the choices",
      operation: "expense",
      compact: false,
      suggestedId: "gone",
      want: [
        ["leavesBalance", ["itauc", "nubc", "car", "ale"]],
        ["goesToStatement", ["click", "itauv", "numc"]],
        ["other", ["rec", "cx", "btc", "pou", "xp"]],
      ],
    },
  ];

  it.each(cases)("$name", ({ operation, compact, suggestedId, want }) => {
    const sections = sectionsOf({
      choices: accounts.map(choiceOf),
      operation,
      compact,
      suggestedId,
      collator,
    });

    expect(
      sections.map((s) => [s.id, s.choices.map((c) => c.account.id)]),
    ).toEqual(want);
    expect(sections.map((s) => s.heading)).toEqual(
      want.map(([id]) => `accountChoice.section.${id}`),
    );
  });
});

function choiceOf([id, name, kind]: [
  string,
  string,
  NonNullable<Account["kind"]>,
]): AccountChoice {
  const account: Account = { id, name, kind, class: "asset", currency: "BRL" };

  return {
    account,
    group: groupOf(account),
    shape: shapeOf(kind),
    institution: undefined,
    logo: undefined,
    progress: undefined,
    balance: undefined,
    freeLimit: undefined,
    consequence: null,
    unavailable: null,
  };
}
