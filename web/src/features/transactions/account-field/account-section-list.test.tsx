import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { AccountSectionList } from "@/features/transactions/account-field/account-section-list";
import type { Section } from "@/features/transactions/account-field/account-sections";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const card = {
  id: "c1",
  name: "Nubank Mastercard",
  class: "liability",
  kind: "credit_card",
  currency: "BRL",
} as Account;

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

type Account = components["schemas"]["Account"];

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

  it("draws the choices of a statement section as cards and keeps rows elsewhere", () => {
    const { container } = draw(vi.fn(), cardSections, true);

    const [inStatement, inOther] = screen.getAllByRole("option", {
      name: /Nubank Mastercard/,
    });

    expect(inStatement).toHaveAttribute("data-lit", "4");
    expect(inOther).not.toHaveAttribute("data-lit");
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(28);
    expect(inOther).toHaveTextContent("R$ 22.337,01");
  });

  it("moves across the columns of a card section with the arrows", async () => {
    draw(vi.fn(), cardSections, true);

    screen.getAllByRole("option", { name: /Nubank Mastercard/ })[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("option", { name: /Itaú Visa/ })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}{ArrowDown}");

    expect(screen.getByRole("option", { name: /Itaú Visa/ })).not.toHaveFocus();
    expect(
      screen.getAllByRole("option", { name: /Nubank Mastercard/ })[1],
    ).toHaveFocus();
  });

  // D3: the block "Other accounts" is closed by default, with its label and count.
  it("keeps the other accounts in a closed block with their count", () => {
    draw(vi.fn(), cardSections);

    const toggle = screen.getByRole("button", { name: /^Outras contas/ });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("1");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("opens the block with its toggle and writes its options", async () => {
    draw(vi.fn(), cardSections);

    await userEvent.click(
      screen.getByRole("button", { name: /^Outras contas/ }),
    );

    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("group", { name: /^Outras contas/ })).toBeVisible();
  });

  it("opens the block when it holds the chosen account", () => {
    renderWithProviders(
      <AccountSectionList
        sections={cardSections}
        value="c3"
        onPick={vi.fn()}
        scale={() => 2}
        suggestion={null}
        label="Pagar com"
      />,
      { fetch: fakeApi({}) },
    );

    expect(
      screen.getByRole("button", { name: /^Outras contas/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("joins the options of the block to the arrows only while it is open", async () => {
    draw(vi.fn(), cardSections);

    screen.getAllByRole("option", { name: /Itaú Visa/ })[0]?.focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: /Itaú Visa/ })).toHaveFocus();

    await userEvent.click(
      screen.getByRole("button", { name: /^Outras contas/ }),
    );
    screen.getByRole("option", { name: /Itaú Visa/ }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(
      screen.getAllByRole("option", { name: /Nubank Mastercard/ })[1],
    ).toHaveFocus();
  });
});

const cardSections: Section[] = [
  {
    id: "goesToStatement",
    heading: "accountChoice.section.goesToStatement",
    choices: [
      cardChoice(card, "Nubank Mastercard"),
      cardChoice({ ...card, id: "c2" }, "Itaú Visa"),
    ],
  },
  {
    id: "other",
    heading: "accountChoice.section.other",
    choices: [cardChoice({ ...card, id: "c3" }, "Nubank Mastercard")],
  },
];

function draw(
  onPick: (id: string) => void,
  shown = sections,
  expandOther = false,
) {
  return renderWithProviders(
    <AccountSectionList
      sections={shown}
      value="a2"
      onPick={onPick}
      scale={() => 2}
      suggestion={{ accountId: "a1", count: 7, total: 10, name: "Mercado" }}
      label="Pagar com"
      expandOther={expandOther}
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

function cardChoice(account: Account, name: string): AccountChoice {
  return {
    ...choiceOf(account.id, name),
    account: { ...account, name },
    group: "cards",
    balance: undefined,
    creditLimit: 3000000,
    freeLimit: 2233701,
  };
}
