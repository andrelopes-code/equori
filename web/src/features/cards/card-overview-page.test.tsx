import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { addMonths } from "@/features/cards/reference-months";
import {
  accounts,
  cardAccount,
  cardID,
  cardRoutes,
  statement,
  statementID,
} from "@/testing/card-api";
import type { Statement } from "@/testing/card-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

function only<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("missing value");
  return value;
}

const base = `/api/v1/accounts/${cardID}`;
const money = (amount: number) => ({ amount, currency: "BRL" });
function statementsRoute(items: Statement[], urls: string[] = []) {
  return {
    [`GET ${base}/statements`]: (req: Request) => {
      urls.push(req.url);
      return json(200, { items });
    },
  };
}

async function renderCard(
  over: Parameters<typeof cardRoutes>[0] = {},
  width = 1280,
) {
  return renderApp(`/cards/${cardID}`, {
    width,
    fetch: fakeApi(cardRoutes(over)),
  });
}

const text = (node: Element | null | undefined) =>
  node?.textContent.replace(/\u00a0/g, " ");

async function openMenu() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: catalogPtBR["cards.menu"] }),
  );
  return user;
}

// Complete frontend C2: the header names the statement and carries its figures.
describe("card header", () => {
  it("names the card, the statement month and its state, with amount, closing, due and available limit", async () => {
    await renderCard();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nubank card" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fatura de nov. de 2026")).toBeInTheDocument();
    const figures = await screen.findByLabelText(catalogPtBR["cards.figures"]);
    expect(
      [...figures.querySelectorAll("dt")].map((term) => term.textContent),
    ).toEqual([
      catalogPtBR["cards.current.amountDue"],
      catalogPtBR["cards.figure.closes"],
      catalogPtBR["cards.figure.due"],
      catalogPtBR["cards.figure.available"],
    ]);
    const figure = within(figures);
    expect(figure.getByText("R$ 500,00")).toBeInTheDocument();
    expect(figure.getByText("3 nov")).toBeInTheDocument();
    expect(figure.getByText("10 nov")).toBeInTheDocument();
    expect(figure.getByText("R$ 4.000,00")).toBeInTheDocument();
    const tag = screen
      .getAllByText(catalogPtBR["cards.status.open"])
      .find((node) => node.closest('[data-ui="tag"]') !== null);
    expect(tag).toBeDefined();
  });

  it("links the settings in place of the available limit without a credit limit", async () => {
    await renderCard({
      [`GET ${base}`]: () => json(200, { ...cardAccount, card: {} }),
    });
    const link = await screen.findByRole("link", {
      name: catalogPtBR["cards.stat.nolimit"],
    });
    expect(link).toHaveAttribute("href", `/cards/${cardID}/settings`);
  });

  it("names the latest statement without an open one", async () => {
    await renderCard(
      statementsRoute([
        statement("2026-09", { status: "paid" }),
        statement("2026-10", { status: "closed" }),
      ]),
    );
    expect(
      await screen.findByText("Fatura de out. de 2026"),
    ).toBeInTheDocument();
    const earlier = screen.getByRole("table", {
      name: catalogPtBR["cards.earlier"],
    });
    expect(within(earlier).getAllByRole("row")).toHaveLength(2);
    expect(text(earlier)).toContain("set. de 2026");
    expect(text(earlier)).not.toContain("out. de 2026");
  });
});

describe("card actions", () => {
  it("links the new purchase and, in the menu, the installment purchase and the settings", async () => {
    await renderCard();
    expect(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.purchase"],
      }),
    ).toHaveAttribute("href", `/transactions/new?account_id=${cardID}`);
    await openMenu();
    expect(
      await screen.findByRole("menuitem", {
        name: catalogPtBR["cards.action.installment"],
      }),
    ).toHaveAttribute("href", `/cards/${cardID}/purchases/new`);
    expect(
      screen.getByRole("menuitem", {
        name: catalogPtBR["cards.action.settings"],
      }),
    ).toHaveAttribute("href", `/cards/${cardID}/settings`);
    expect(screen.queryByText(catalogPtBR["cards.rule.missing"])).toBeNull();
  });

  it("explains the missing billing rule and disables the installment purchase (C17)", async () => {
    await renderCard({
      [`GET ${base}/billing-cycle-rules`]: () => json(200, { items: [] }),
    });
    const message = await screen.findByText(catalogPtBR["cards.rule.missing"]);
    expect(
      within(
        only(message.closest<HTMLElement>('[data-ui="inline-message"]')),
      ).getByRole("link", {
        name: catalogPtBR["cards.rule.link"],
      }),
    ).toHaveAttribute("href", `/cards/${cardID}/settings`);
    await openMenu();
    const item = await screen.findByRole("menuitem", {
      name: catalogPtBR["cards.action.installment"],
    });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).not.toHaveAttribute("href");
  });

  it("pays the current statement while it has an unpaid amount", async () => {
    await renderCard();
    expect(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.pay"],
      }),
    ).toHaveAttribute(
      "href",
      `/cards/${cardID}/statements/${statementID("2026-11")}/pay`,
    );
  });

  it("pays an overdue statement before the current one", async () => {
    await renderCard(
      statementsRoute([
        statement("2026-09", { status: "overdue" }),
        statement("2026-11"),
      ]),
    );
    expect(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.pay"],
      }),
    ).toHaveAttribute(
      "href",
      `/cards/${cardID}/statements/${statementID("2026-09")}/pay`,
    );
  });

  it("offers no payment when the current statement has nothing unpaid", async () => {
    await renderCard(
      statementsRoute([statement("2026-11", { unpaid: money(0) })]),
    );
    await screen.findByText("Fatura de nov. de 2026");
    expect(
      screen.queryByRole("link", { name: catalogPtBR["cards.action.pay"] }),
    ).toBeNull();
  });
});

// Complete frontend C3.
describe("card statement", () => {
  it("requests the statements from twelve months back with the page limit", async () => {
    const urls: string[] = [];
    await renderCard(statementsRoute([statement("2026-11")], urls));
    await screen.findByText("Fatura de nov. de 2026");
    expect(urls.map((url) => new URL(url).search)).toEqual([
      "?from=2025-10&limit=200",
    ]);
  });

  it("lists the charges and credits of the statement with the total and the line count", async () => {
    await renderCard();
    const table = await screen.findByRole("table", {
      name: catalogPtBR["cards.lines"],
    });
    await within(table).findByText("Mercado");
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => text(row));
    expect(rows).toEqual([
      "9 outEstorno loja−20,00",
      "8 outNotebook · 2/10300,00",
      "5 outMercado220,00",
      "Total da fatura · 3 lançamentos500,00",
    ]);
  });

  it("shows what the next six statements already hold, with a bar per month", async () => {
    const urls: string[] = [];
    await renderCard({
      [`GET ${base}/commitments`]: (req) => {
        const month = new URL(req.url).searchParams.get("month") ?? "";
        urls.push(month);
        return json(200, {
          month,
          amount: money(month === "2026-12" ? 45000 : 30000),
        });
      },
    });
    const table = await screen.findByRole("table", {
      name: catalogPtBR["cards.committed"],
    });
    await waitFor(() => {
      expect(text(table)).toContain("450,00");
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => text(row))).toEqual([
      "dez. de 2026450,00",
      "jan. de 2027300,00",
      "fev. de 2027300,00",
      "mar. de 2027300,00",
      "abr. de 2027300,00",
      "mai. de 2027300,00",
    ]);
    expect(
      rows.map((row) => row.querySelector('[data-own="budget-bar"]')),
    ).not.toContain(null);
    expect([...urls].sort()).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
    ]);
  });

  it("lists the earlier statements with due date, state tone and amount", async () => {
    await renderCard(
      statementsRoute([
        statement("2026-08", { status: "overdue" }),
        statement("2026-09", { status: "paid" }),
        statement("2026-10", { status: "closed", amount_due: money(7000) }),
        statement("2026-11"),
        statement("2026-12"),
      ]),
    );
    const earlier = await screen.findByRole("table", {
      name: catalogPtBR["cards.earlier"],
    });
    const rows = within(earlier).getAllByRole("row").slice(1);
    expect(rows.map((row) => text(row))).toEqual([
      `out. de 202610/10/2026${catalogPtBR["cards.status.closed"]}70,00`,
      `set. de 202610/09/2026${catalogPtBR["cards.status.paid"]}500,00`,
      `ago. de 202610/08/2026${catalogPtBR["cards.status.overdue"]}500,00`,
    ]);
    expect(
      rows.map((row) =>
        row.querySelector('[data-ui="tag"]')?.getAttribute("data-tone"),
      ),
    ).toEqual(["accent", "success", "danger"]);
    expect(within(only(rows[0])).getByRole("link")).toHaveAttribute(
      "href",
      `/cards/${cardID}/statements/${statementID("2026-10")}`,
    );
  });

  it("moves the window back twelve months for the earlier statements", async () => {
    const urls: string[] = [];
    const { router } = await renderCard(
      statementsRoute([statement("2026-11")], urls),
    );
    await userEvent.setup().click(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.earlier"],
      }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ from: "2024-10" });
    });
    await waitFor(() => {
      expect(urls.map((url) => new URL(url).search)).toEqual([
        "?from=2025-10&limit=200",
        "?from=2024-10&limit=200",
      ]);
    });
  });

  it("reads every statement page", async () => {
    const urls: string[] = [];
    const first = Array.from({ length: 12 }, (_, n) =>
      statement(addMonths("2025-10", n), { status: "paid" }),
    );
    await renderCard({
      [`GET ${base}/statements`]: (req) => {
        urls.push(req.url);
        const cursor = new URL(req.url).searchParams.get("cursor");
        return cursor === "c2"
          ? json(200, { items: [statement("2026-10")] })
          : json(200, { items: first, next_cursor: "c2" });
      },
    });
    expect(
      await screen.findByText("Fatura de out. de 2026"),
    ).toBeInTheDocument();
    expect(urls.map((url) => new URL(url).searchParams.get("cursor"))).toEqual([
      null,
      "c2",
    ]);
  });
});

// Complete frontend C1.
describe("cards page", () => {
  it("opens the card page when there is one card account", async () => {
    const { router } = await renderApp("/cards", {
      width: 1280,
      fetch: fakeApi(cardRoutes()),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/cards/${cardID}`);
    });
  });

  it("lists every card account when there are several", async () => {
    const second = { ...cardAccount, id: "c2", name: "Itaú card" };
    await renderApp("/cards", {
      width: 1280,
      fetch: fakeApi(
        cardRoutes({
          "GET /api/v1/accounts": () =>
            json(200, { items: [...accounts, second] }),
        }),
      ),
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogPtBR["nav.cards"],
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Nubank card/ }),
    ).toHaveAttribute("href", `/cards/${cardID}`);
    expect(screen.getByRole("link", { name: /Itaú card/ })).toHaveAttribute(
      "href",
      "/cards/c2",
    );
  });

  it("points to the accounts without a card account", async () => {
    await renderApp("/cards", {
      width: 1280,
      fetch: fakeApi(
        cardRoutes({
          "GET /api/v1/accounts": () => json(200, { items: accounts.slice(1) }),
        }),
      ),
    });
    expect(
      await screen.findByText(catalogPtBR["cards.list.empty"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: catalogPtBR["cards.list.empty.action"],
      }),
    ).toHaveAttribute("href", "/accounts");
  });
});
