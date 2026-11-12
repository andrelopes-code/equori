import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { AccountCardOption } from "@/features/transactions/account-field/account-card-option";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Account = components["schemas"]["Account"];

const card = {
  id: "c1",
  name: "Nubank Mastercard",
  class: "liability",
  kind: "credit_card",
  currency: "BRL",
} as Account;

describe("AccountCardOption", () => {
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

  it("writes the free limit in parts and lights the used segments", () => {
    const { container } = draw(
      choiceOf({ creditLimit: 3000000, freeLimit: 2233701 }),
    );

    expect(screen.getByText("Nubank Mastercard")).toBeInTheDocument();
    expect(screen.getByText("R$")).toBeInTheDocument();
    expect(screen.getByText("22.337")).toBeInTheDocument();
    expect(screen.getByText(",01")).toBeInTheDocument();
    expect(screen.getByText("livre")).toBeInTheDocument();
    expect(screen.getByRole("option")).toHaveAttribute("data-lit", "4");
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(14);
    expect(container.querySelectorAll("[data-segment][data-on]")).toHaveLength(
      4,
    );
  });

  it("draws no meter for a card without a credit limit", () => {
    const { container } = draw(choiceOf({ freeLimit: 2233701 }));

    expect(screen.getByRole("option")).not.toHaveAttribute("data-lit");
    expect(container.querySelector("[data-segment]")).toBeNull();
  });

  it("marks an unavailable card and says how much limit is missing", () => {
    draw(
      choiceOf({
        creditLimit: 100000,
        freeLimit: 15000,
        unavailable: { reason: "noFreeLimit", missing: 13640 },
      }),
    );

    expect(screen.getByText("Faltam R$ 136,40 de limite")).toBeInTheDocument();
    expect(screen.getByRole("option")).toHaveAttribute("aria-disabled", "true");
  });

  it("marks the chosen card", () => {
    draw(choiceOf({ freeLimit: 1000 }), true);

    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("option", { name: /Nubank Mastercard/ }),
    ).toBeInTheDocument();
  });

  it("writes the closed statement on the same line as the statement", () => {
    draw(
      choiceOf({
        freeLimit: 1123839,
        consequence: {
          kind: "statement",
          dueDate: "2026-12-17",
          closedOn: "2026-12-10",
        },
      }),
    );

    const statement = screen.getByText("Fatura de 17/12");
    const closed = screen.getByText("fechou dia 10");

    expect(statement.parentElement).toBe(closed.parentElement);
  });

  it("writes the kind of a card with no consequence", () => {
    draw(choiceOf({ freeLimit: 1000 }));

    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
  });

  it("never draws the warning triangle", () => {
    const { container } = draw(
      choiceOf({
        freeLimit: 15000,
        unavailable: { reason: "noFreeLimit", missing: 13640 },
      }),
    );

    expect(container.textContent).not.toMatch(/⚠|▲|△/);
  });
});

function draw(choice: AccountChoice, chosen = false) {
  return renderWithProviders(
    <AccountCardOption
      choice={choice}
      chosen={chosen}
      tabStop={false}
      scale={2}
      onPick={() => undefined}
    />,
    { fetch: fakeApi({}) },
  );
}

function choiceOf(over: Partial<AccountChoice>): AccountChoice {
  return {
    account: card,
    group: "cards",
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
