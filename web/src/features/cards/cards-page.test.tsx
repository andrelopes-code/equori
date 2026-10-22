import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  cardID,
  cardRoutes,
  closedStatementID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

function api(overrides: Record<string, Route> = {}) {
  return fakeApi(accountRoutes({ ...cardRoutes(), ...overrides }));
}

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

const oldCard = {
  ...accountFixtures.find((a) => a.id === cardID),
  id: "a1000000-0000-4000-8000-0000000000c2",
  name: "Cartão antigo",
  closed_on: "2026-03-31",
};

describe("CardsPage", () => {
  it("adds up the open statements, what is due and the free limit", async () => {
    await renderApp("/cards", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["cards.figures"],
    });
    expect(await within(figures).findByText("R$2,500.00")).toBeInTheDocument();
    expect(within(figures).getByText("R$1,800.00")).toBeInTheDocument();
    expect(within(figures).getByText("R$5,500.00")).toBeInTheDocument();
    expect(
      within(figures).getByText(words("cards.dueNote", { date: "10/25/2026" })),
    ).toBeInTheDocument();
  });

  it("shows each card's statement, dates and limit", async () => {
    await renderApp("/cards", { fetch: api() });
    const tile = await screen.findByRole("article", { name: "Itaú Visa" });
    expect(
      await within(tile).findByText(catalogEn["statement.status.open"]),
    ).toBeInTheDocument();
    expect(
      within(tile).getByText(
        words("cards.closesDue", { closing: "11/05/2026", due: "11/12/2026" }),
      ),
    ).toBeInTheDocument();
    // Spec 2026-10-21-account-card-design: the card's meter replaces the limit progress bar.
    const face = within(tile).getByRole("link", {
      name: "Itaú Visa, credit, open statement · due Nov 12: R$2,500.00",
    });
    expect(face).toHaveAttribute("href", `/cards/${cardID}`);
    expect(within(face).getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "31% of the limit, R$5,500 free",
    );
    expect(within(tile).queryByRole("progressbar")).toBeNull();
  });

  it("draws the week's purchases from Monday to today on the card", async () => {
    await renderApp("/cards", { fetch: api() });
    const tile = await screen.findByRole("article", { name: "Itaú Visa" });
    const chip = await within(tile).findByRole("img", {
      name: "spent this week: R$55.00",
    });
    expect(chip.querySelectorAll("[data-last]")).toHaveLength(1);
    expect(chip.firstElementChild?.childElementCount).toBe(6);
  });

  it("offers to pay a closed statement still owing", async () => {
    const { router } = await renderApp("/cards", { fetch: api() });
    const tile = await screen.findByRole("article", { name: "Itaú Visa" });
    expect(
      await within(tile).findByText(
        words("cards.unpaid", { date: "10/25/2026", amount: "R$1,800.00" }),
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(tile).getByRole("button", { name: catalogEn["cards.pay"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/cards/${cardID}/statements/${closedStatementID}`,
      );
    });
    expect(router.state.location.search).toMatchObject({ pay: true });
  });

  it("creates a card through the account form", async () => {
    const { router } = await renderApp("/cards", { fetch: api() });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["cards.new"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/accounts/new");
    });
    expect(router.state.location.search).toMatchObject({ kind: "credit_card" });
  });

  it("shows closed cards only when asked", async () => {
    await renderApp("/cards", {
      fetch: api({
        "GET /api/v1/accounts": () =>
          json(200, { items: [...accountFixtures, oldCard] }),
        [`GET /api/v1/accounts/${oldCard.id}/statements`]: () =>
          json(200, { items: [] }),
      }),
    });
    await screen.findByRole("article", { name: "Itaú Visa" });
    expect(
      screen.queryByRole("article", { name: "Cartão antigo" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("switch", { name: catalogEn["cards.showClosed"] }),
    );
    expect(
      await screen.findByRole(
        "article",
        { name: "Cartão antigo" },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
  });

  it("offers the first card when there is none", async () => {
    await renderApp("/cards", {
      fetch: api({
        "GET /api/v1/accounts": () =>
          json(200, { items: accountFixtures.filter((a) => a.id !== cardID) }),
      }),
    });
    expect(
      await screen.findByText(catalogEn["cards.empty"]),
    ).toBeInTheDocument();
  });
});
