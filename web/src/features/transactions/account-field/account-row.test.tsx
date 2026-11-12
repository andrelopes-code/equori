import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { AccountRow } from "@/features/transactions/account-field/account-row";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Account = components["schemas"]["Account"];

const checking = {
  id: "a1",
  name: "Conta Nubank",
  class: "asset",
  kind: "checking",
  currency: "BRL",
} as Account;
const card = {
  id: "c1",
  name: "Nubank Mastercard",
  class: "liability",
  kind: "credit_card",
  currency: "BRL",
} as Account;

describe("AccountRow", () => {
  beforeEach(() => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem("equori.locale");
  });

  it("shows the name, the kind, the balance and its label", () => {
    const { container } = draw(choiceOf(checking, { balance: 81969 }));

    const row = screen.getByRole("option", { name: /Conta Nubank/ });

    expect(row).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Conta Nubank")).toBeInTheDocument();
    expect(screen.getByText("Conta corrente")).toBeInTheDocument();
    expect(screen.getByText("R$ 819,69")).toBeInTheDocument();
    expect(screen.getByText("saldo")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("writes an overdraw in words in the place of the label", () => {
    draw(
      choiceOf(checking, {
        balance: 81969,
        consequence: { kind: "overdraw", after: -26651 },
      }),
    );

    expect(screen.getByText("ficaria −R$ 266,51")).toBeInTheDocument();
    expect(screen.getByText("R$ 819,69")).toBeInTheDocument();
    expect(screen.queryByText("saldo")).not.toBeInTheDocument();
  });

  it("writes a reserve risk in words in the place of the label", () => {
    draw(
      choiceOf(checking, {
        balance: 81969,
        consequence: { kind: "reserve", after: 55318 },
      }),
    );

    expect(screen.getByText("sai da reserva")).toBeInTheDocument();
  });

  it("shows the statement and the free limit of a card, in both forms", () => {
    draw(
      choiceOf(card, {
        group: "cards",
        freeLimit: 1123839,
        consequence: {
          kind: "statement",
          dueDate: "2026-12-17",
          closedOn: "2026-12-10",
        },
      }),
    );

    expect(
      screen.getByText("Fatura de 17/12 · fechou dia 10"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fatura de 17/12")).toBeInTheDocument();
    expect(screen.getByText("R$ 11.238,39")).toBeInTheDocument();
    expect(screen.getByText("limite livre")).toBeInTheDocument();
  });

  it("marks an unavailable card and says how much limit is missing", () => {
    draw(
      choiceOf(card, {
        group: "cards",
        freeLimit: 15000,
        unavailable: { reason: "noFreeLimit", missing: 13640 },
      }),
    );

    expect(screen.getByText("Faltam R$ 136,40 de limite")).toBeInTheDocument();
    expect(screen.getByRole("option")).toHaveAttribute("aria-disabled", "true");
  });

  it("writes the English fact with the date of the active locale", () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "US" }),
    );
    draw(
      choiceOf(card, {
        group: "cards",
        freeLimit: 1123839,
        consequence: { kind: "settles", dueDate: "2026-12-17" },
      }),
    );

    expect(
      screen.getByText("Pays the statement due 12/17"),
    ).toBeInTheDocument();
    expect(screen.getByText("free limit")).toBeInTheDocument();
  });

  it("marks the chosen row with a check and draws no warning triangle", () => {
    const { container } = draw(
      choiceOf(checking, {
        balance: 100,
        consequence: { kind: "overdraw", after: -5 },
      }),
      true,
    );

    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).not.toMatch(/fica |⚠|▲|△/);
  });
});

function draw(choice: AccountChoice, chosen = false) {
  return renderWithProviders(
    <AccountRow
      choice={choice}
      chosen={chosen}
      tabStop={false}
      scale={2}
      onPick={() => undefined}
    />,
    { fetch: fakeApi({}) },
  );
}

function choiceOf(
  account: Account,
  over: Partial<AccountChoice>,
): AccountChoice {
  return {
    account,
    group: "accounts",
    shape: "square",
    institution: undefined,
    logo: undefined,
    progress: undefined,
    balance: undefined,
    freeLimit: undefined,
    creditLimit: undefined,
    consequence: null,
    unavailable: null,
    ...over,
  };
}
