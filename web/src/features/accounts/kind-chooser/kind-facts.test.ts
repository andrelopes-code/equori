import { describe, expect, it } from "vitest";

import { kindFacts } from "@/features/accounts/kind-chooser/kind-facts";
import type { KindStep } from "@/features/accounts/kind-chooser/kind-facts";
import { kinds } from "@/features/accounts/model/account-kinds";
import type { Kind } from "@/features/accounts/model/account-kinds";
import { accountsEn } from "@/i18n/catalog-accounts.en";
import { accountsPtBR } from "@/i18n/catalog-accounts.pt-BR";

const common: readonly KindStep[] = [
  { key: "kindPanel.stepIdentity", own: false },
  { key: "kindPanel.stepDetails", own: false },
];
const yielding: readonly KindStep[] = [
  ...common,
  { key: "accountForm.yield", own: true },
  { key: "accountForm.opening", own: false },
];
const plain: readonly KindStep[] = [
  ...common,
  { key: "accountForm.opening", own: false },
];
const owed: readonly KindStep[] = [
  ...common,
  { key: "accountForm.openingOwed", own: false },
];

interface Row {
  kind: Kind;
  side: "asset" | "liability";
  steps: readonly KindStep[];
  opensIn: "nav.cards" | "nav.accounts";
  liquid: boolean;
  countLabel: "kindPanel.cards" | "kindPanel.accounts";
  noneLabel: "kindPanel.noCards" | "kindPanel.noAccounts";
}

const asset = { side: "asset", opensIn: "nav.accounts" } as const;
const accounts = {
  countLabel: "kindPanel.accounts",
  noneLabel: "kindPanel.noAccounts",
} as const;

const rows: readonly Row[] = [
  { kind: "checking", ...asset, steps: plain, liquid: true, ...accounts },
  { kind: "cash", ...asset, steps: plain, liquid: true, ...accounts },
  { kind: "wallet", ...asset, steps: plain, liquid: true, ...accounts },
  { kind: "benefit", ...asset, steps: plain, liquid: false, ...accounts },
  { kind: "savings", ...asset, steps: yielding, liquid: true, ...accounts },
  { kind: "reserve", ...asset, steps: yielding, liquid: true, ...accounts },
  {
    kind: "brokerage",
    ...asset,
    steps: [
      { key: "kindPanel.stepIdentity", own: false },
      { key: "kindPanel.stepDetailsNoParent", own: false },
      {
        key: "kindPanel.stepCashMode",
        wrap: "kindPanel.afterInstitution",
        own: true,
      },
      { key: "kindPanel.stepOwnCash", own: false },
    ],
    liquid: false,
    ...accounts,
  },
  { kind: "receivable", ...asset, steps: plain, liquid: false, ...accounts },
  { kind: "property", ...asset, steps: plain, liquid: false, ...accounts },
  {
    kind: "credit_card",
    side: "liability",
    steps: [
      ...common,
      { key: "accountForm.openingCard", own: false },
      { key: "accountForm.billing", own: true },
      { key: "accountForm.limitGroup", own: true },
      { key: "accountForm.cards", own: true },
    ],
    opensIn: "nav.cards",
    liquid: false,
    countLabel: "kindPanel.cards",
    noneLabel: "kindPanel.noCards",
  },
  {
    kind: "loan",
    side: "liability",
    steps: owed,
    opensIn: "nav.accounts",
    liquid: false,
    ...accounts,
  },
  {
    kind: "payable",
    side: "liability",
    steps: owed,
    opensIn: "nav.accounts",
    liquid: false,
    ...accounts,
  },
];

describe("kindFacts", () => {
  it("covers every kind once", () => {
    expect(rows.map((r) => r.kind).sort()).toEqual([...kinds].sort());
  });

  it.each(rows)("derives the facts of $kind", ({ kind, ...facts }) => {
    expect(kindFacts(kind)).toEqual(facts);
  });

  it("has an en and a pt-BR text for every key of the panel", () => {
    const keys = Object.keys(accountsEn).filter(
      (k) => k.startsWith("kindPanel.") || k.startsWith("kindChooser."),
    );

    expect(keys).toHaveLength(29);
    for (const key of keys) {
      expect(accountsPtBR[key as keyof typeof accountsPtBR]).toBeTruthy();
    }
    expect(accountsEn["accountForm.continue"]).toBe("Continue");
    expect(accountsPtBR["accountForm.continue"]).toBe("Continuar");
  });
});
