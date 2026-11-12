import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSectionList } from "@/features/transactions/account-field/account-section-list";
import type { Section } from "@/features/transactions/account-field/account-sections";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const sections: Section[] = [
  {
    id: "suggested",
    heading: "accountChoice.section.suggested",
    choices: [choiceOf("a1", "Conta Nubank")],
  },
  {
    id: "accounts",
    heading: "accountChoice.section.accounts",
    choices: [choiceOf("a2", "Carteira"), choiceOf("a3", "Itaú")],
  },
];

describe("AccountSectionList", () => {
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

  it("names each section and writes the hint of the suggestion", () => {
    draw(vi.fn());

    expect(screen.getByRole("listbox", { name: "Pagar com" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Sugerida" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Contas" })).toBeVisible();
    expect(screen.getByText("7 das últimas 10 em Mercado")).toBeVisible();
  });

  it("keeps one tab stop, on the chosen option", () => {
    draw(vi.fn());

    const stops = screen
      .getAllByRole("option")
      .filter((option) => option.tabIndex === 0);

    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName(/Carteira/);
  });

  it("moves across the sections with the arrows and chooses with Enter", async () => {
    const onPick = vi.fn();
    draw(onPick);

    screen.getByRole("option", { name: /Conta Nubank/ }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: /Carteira/ })).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    expect(screen.getByRole("option", { name: /Itaú/ })).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}{Enter}");

    expect(onPick).toHaveBeenCalledExactlyOnceWith("a2");
  });
});

function draw(onPick: (id: string) => void) {
  return renderWithProviders(
    <AccountSectionList
      sections={sections}
      value="a2"
      onPick={onPick}
      scale={() => 2}
      suggestion={{ accountId: "a1", count: 7, total: 10, name: "Mercado" }}
      label="Pagar com"
    />,
    { fetch: fakeApi({}) },
  );
}

function choiceOf(id: string, name: string): AccountChoice {
  return {
    account: {
      id,
      name,
      class: "asset",
      kind: "checking",
      currency: "BRL",
    },
    group: "accounts",
    shape: "square",
    institution: undefined,
    logo: undefined,
    progress: undefined,
    balance: 1000,
    freeLimit: undefined,
    creditLimit: undefined,
    consequence: null,
    unavailable: null,
  };
}
