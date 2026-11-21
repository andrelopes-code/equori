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
  money,
  statementFixtures,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { moneyValue } from "@/testing/money-value";
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
  it("reserves the cards while the accounts load", async () => {
    await renderApp("/cards", {
      fetch: api({
        "GET /api/v1/accounts": () => new Promise<Response>(() => undefined),
      }),
    });

    const faces = await screen.findAllByRole("group", {
      name: catalogEn["cardFace.loading"],
    });

    expect(faces).toHaveLength(2);
  });

  // Spec 2026-11-21-mobile-accounts, MA4: on a phone the sentence under the title leaves; it was
  // cut at the header's action, and the figures below say what it described.
  it("draws no subheading on a phone", async () => {
    await renderApp("/cards", { width: 390, fetch: api() });
    await screen.findByRole("region", { name: catalogEn["cards.figures"] });

    expect(screen.queryByText(/: what (each|it) bills now/)).toBeNull();
  });

  it("adds up the open statements, what is due and the free limit", async () => {
    await renderApp("/cards", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["cards.figures"],
    });
    expect(
      await within(figures).findByText(moneyValue("R$2,500.00")),
    ).toBeInTheDocument();
    expect(
      within(figures).getByText(moneyValue("R$1,800.00")),
    ).toBeInTheDocument();
    expect(
      within(figures).getByText(moneyValue("R$5,500.00")),
    ).toBeInTheDocument();
    expect(
      within(figures).getByText(words("cards.dueNote", { date: "10/25/2026" })),
    ).toBeInTheDocument();
  });

  it("flags what is due past its date and a free limit below zero", async () => {
    await renderApp("/cards", {
      fetch: api({
        "GET /api/v1/accounts": () =>
          json(200, {
            items: accountFixtures.map((a) =>
              a.id === cardID
                ? {
                    ...a,
                    card: {
                      credit_limit: money(800000),
                      available_limit: money(-40000),
                    },
                  }
                : a,
            ),
          }),
        [`GET /api/v1/accounts/${cardID}/statements`]: () =>
          json(200, {
            items: statementFixtures.map((s) =>
              s.reference === "2026-10" ? { ...s, status: "overdue" } : s,
            ),
          }),
      }),
    });

    const figures = await screen.findByRole("region", {
      name: catalogEn["cards.figures"],
    });
    const due = within(figures).getByRole("group", {
      name: catalogEn["cards.figure.due"],
    });
    const free = within(figures).getByRole("group", {
      name: catalogEn["cards.figure.available"],
    });

    await waitFor(() => {
      expect(due).toHaveAttribute("data-attention", "danger");
    });
    expect(
      within(due).getByText(
        words("statement.overdueSince", { date: "10/25/2026" }),
      ),
    ).toBeInTheDocument();
    expect(free).toHaveAttribute("data-attention", "danger");
    expect(
      within(free).getByText(
        words("accountCard.meter.credit.over", { amount: "R$400.00" }),
      ),
    ).toBeInTheDocument();
    expect(
      within(figures).getByRole("group", {
        name: catalogEn["cards.figure.open"],
      }),
    ).not.toHaveAttribute("data-attention");
  });

  it("shows each card's statement and limit on the card face only", async () => {
    await renderApp("/cards", { fetch: api() });
    const tile = await screen.findByRole("article", { name: "Itaú Visa" });
    // Spec 2026-11-16-card-faces-design, 4.8 and 7: the limit meter sits on the ticket and the
    // link is named by the face.
    const face = await within(tile).findByRole("link", {
      name: "Itaú Visa, ending 1234",
    });
    expect(
      within(tile).queryByText(catalogEn["statement.status.open"]),
    ).toBeNull();
    expect(
      within(tile).queryByText(
        words("cards.closesDue", { closing: "11/05/2026", due: "11/12/2026" }),
      ),
    ).toBeNull();
    expect(face).toHaveAttribute("href", `/cards/${cardID}`);
    expect(within(tile).getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "31% of the limit, R$5,500 free",
    );
    expect(within(tile).queryByRole("progressbar")).toBeNull();
  });

  it("draws the stored appearance of a card", async () => {
    await renderApp("/cards", {
      fetch: api({
        "GET /api/v1/accounts": () =>
          json(200, {
            items: accountFixtures.map((a) =>
              a.id === cardID
                ? { ...a, face: { color: "#fce300", art: "waves" } }
                : a,
            ),
          }),
      }),
    });
    const tile = await screen.findByRole("article", { name: "Itaú Visa" });
    const face = await within(tile).findByRole("link", {
      name: "Itaú Visa, ending 1234",
    });

    expect(face).toHaveAttribute("data-art", "waves");
    expect(face).toHaveAttribute("data-ink", "dark");
  });

  it("keeps the evidence of a statement closed until asked", async () => {
    await renderApp("/cards", { fetch: api() });
    const tile = await screen.findByRole("article", { name: "Itaú Visa" });
    const toggle = await within(tile).findByRole("button", {
      name: words("cards.ticket.details", { title: "Itaú Visa" }),
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
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
    const stub = await within(tile).findByRole("group", {
      name: catalogEn["cards.stub.name"],
    });
    expect(stub).toHaveAttribute("data-status", "info");
    expect(
      within(stub).getByText(words("cards.stub.due", { when: "in 8 days" })),
    ).toBeInTheDocument();
    expect(
      within(stub).getByText(
        words("cards.stub.reference", { month: "Oct-2026" }),
      ),
    ).toBeInTheDocument();
    expect(within(stub).getByText("R$1,800.00")).toBeInTheDocument();
    expect(
      within(stub).getByRole("img", {
        name: words("cards.ticket.cycle", { closing: "Oct 5", due: "Oct 25" }),
      }),
    ).toBeInTheDocument();
    expect(within(stub).queryByRole("progressbar")).toBeNull();
    await userEvent.click(
      within(stub).getByRole("button", { name: catalogEn["cards.pay"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/cards/${cardID}/statements/${closedStatementID}`,
      );
    });
    expect(router.state.location.search).toMatchObject({ pay: true });
  });

  it.each([
    ["2026-10-18", "warning"],
    ["2026-10-10", "danger"],
  ])(
    "draws the pay button of a statement due %s in the tone %s",
    async (dueDate, tone) => {
      await renderApp("/cards", {
        fetch: api({
          [`GET /api/v1/accounts/${cardID}/statements`]: () =>
            json(200, {
              items: statementFixtures.map((s) =>
                s.reference === "2026-10" ? { ...s, due_date: dueDate } : s,
              ),
            }),
        }),
      });
      const tile = await screen.findByRole("article", { name: "Itaú Visa" });
      const stub = await within(tile).findByRole("group", {
        name: catalogEn["cards.stub.name"],
      });

      expect(stub).toHaveAttribute("data-status", tone);
      expect(
        within(stub).getByRole("button", { name: catalogEn["cards.pay"] }),
      ).toHaveAttribute("data-tone", tone);
    },
  );

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

describe("CardsPage on a phone (ADR 027, S6)", () => {
  it("offers no new card", async () => {
    await renderApp("/cards", { fetch: api(), width: 390 });
    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.queryByRole("button", { name: catalogEn["cards.new"] }),
    ).toBeNull();
  });
});
