import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";
import { setViewport } from "@/testing/viewport";

const html = document.documentElement;

function newFetch() {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: "user-1", email: "owner@example.com" }),
  });
}

beforeEach(() => {
  localStorage.clear();
  html.removeAttribute("lang");
  html.removeAttribute("data-slotted-density");
  html.removeAttribute("data-slotted-scheme");
});

// Ledger sheet decisions L5, L7 and L8; complete frontend G7; shell second pass S1 and S2.
describe("AppFrame navigation", () => {
  // Shell second pass S2: below 1024 px a bottom bar of five controls, New in the middle.
  it.each([360, 768])(
    "shows five text controls in the bottom bar at %i px",
    async (width) => {
      const { container } = await renderApp("/", {
        width,
        fetch: newFetch(),
      });
      const bar = container.querySelector('[data-own="bottom-bar"]');
      const controls = [...(bar?.querySelectorAll("a, button") ?? [])];
      expect(controls.map((control) => control.textContent)).toEqual([
        catalogEn["nav.home"],
        catalogEn["nav.transactions"],
        catalogEn["nav.entry"],
        catalogEn["nav.cards"],
        catalogEn["nav.more"],
      ]);
      expect(controls[2]).toHaveAttribute("data-emphasis", "ink");
      expect(controls[2]?.tagName).toBe("BUTTON");
      expect(bar?.querySelectorAll("svg")).toHaveLength(5);
      expect(container.querySelector('[data-own="ledger-index"]')).toBeNull();
      expect(container.querySelector('[data-ui="top-navigation"]')).toBeNull();
      expect(html).toHaveAttribute("data-slotted-density", "comfortable");
    },
  );

  it("draws the shell edge to edge at every width", async () => {
    for (const width of [360, 768, 1280]) {
      const view = await renderApp("/", { width, fetch: newFetch() });
      expect(
        view.container.querySelector('[data-ui="app-shell"]'),
      ).toHaveAttribute("data-canvas", "flush");
      view.unmount();
    }
  });

  // Shell second pass S1: from 1024 px the destinations stand in an index beside the page.
  it("shows the ledger index at 1280 px", async () => {
    const { container } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    expect(container.querySelector('[data-own="ledger-index"]')).not.toBeNull();
    expect(container.querySelector('[data-own="bottom-bar"]')).toBeNull();
    expect(container.querySelector('[data-ui="top-navigation"]')).toBeNull();
  });

  // A narrow window closes the shell's navigation; widening it again must show the whole index.
  it("keeps the ledger index open after the window narrows and widens again", async () => {
    const { container } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    act(() => {
      setViewport(360);
    });
    act(() => {
      setViewport(1280);
    });
    await waitFor(() => {
      expect(
        container.querySelector('[data-own="ledger-index"]'),
      ).not.toBeNull();
    });
    expect(container.querySelector('[data-ui="app-shell"]')).toHaveAttribute(
      "data-open",
    );
  });

  it("lays no scrim over the page on a phone", async () => {
    const { container } = await renderApp("/", {
      width: 360,
      fetch: newFetch(),
    });
    expect(
      container.querySelector('[data-ui="app-shell"]'),
    ).not.toHaveAttribute("data-open");
  });

  it("swaps the bottom bar for the ledger index without a reload", async () => {
    const { container } = await renderApp("/", {
      width: 360,
      fetch: newFetch(),
    });
    expect(container.querySelector('[data-own="bottom-bar"]')).not.toBeNull();
    act(() => {
      setViewport(1280);
    });
    await waitFor(() => {
      expect(container.querySelector('[data-own="bottom-bar"]')).toBeNull();
    });
    expect(container.querySelector('[data-own="ledger-index"]')).not.toBeNull();
  });

  it.each([
    [{ items: [], next_cursor: undefined }, null],
    [{ items: [{}, {}, {}] }, "3"],
    [{ items: [{}], next_cursor: "next" }, "200+"],
  ] as const)(
    "shows the uncategorized count beside Transactions",
    async (page, badge) => {
      const fetch = fakeApi({
        "GET /api/v1/me": () =>
          json(200, { id: "user-1", email: "owner@example.com" }),
        "GET /api/v1/transactions": () => json(200, page),
      });
      for (const width of [360, 1280]) {
        const view = await renderApp("/", { width, fetch });
        const link = await screen.findByRole("link", {
          name: new RegExp(`^${catalogEn["nav.transactions"]}`),
        });
        await waitFor(() => {
          expect(
            link.querySelector(
              '[data-own="index-count"], [data-own="bar-count"]',
            )?.textContent ?? null,
          ).toBe(badge);
        });
        view.unmount();
      }
    },
  );
});

describe("AppFrame routing", () => {
  it("navigates from the ledger index without a reload", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    await user.click(
      screen.getByRole("link", { name: catalogEn["nav.accounts"] }),
    );
    expect(router.state.location.pathname).toBe("/accounts");
  });

  it("marks Transactions current on a transaction detail route", async () => {
    await renderApp("/transactions/abc", { width: 1280, fetch: newFetch() });
    expect(
      screen.getByRole("link", { name: catalogEn["nav.transactions"] }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: catalogEn["nav.overview"] }),
    ).not.toHaveAttribute("aria-current");
  });

  // Complete frontend F2: the index's entry field opens the quick entry.
  it("opens the quick entry from the index's entry field", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 1280, fetch: fakeApi(sharedRoutes) });
    await user.click(
      screen.getByRole("button", { name: new RegExp(catalogEn["nav.entry"]) }),
    );
    expect(
      await screen.findByRole("dialog", { name: catalogEn["entry.title"] }),
    ).toBeInTheDocument();
  });

  // Complete frontend G7.
  it("lists Overview, Transactions, Goals, Cards and Accounts in the ledger index", async () => {
    await renderApp("/", { width: 1280, fetch: newFetch() });
    const nav = screen.getByRole("navigation", {
      name: catalogEn["nav.label"],
    });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(5);
    [
      catalogEn["nav.overview"],
      catalogEn["nav.transactions"],
      catalogEn["nav.goals"],
      catalogEn["nav.cards"],
      catalogEn["nav.accounts"],
    ].forEach((name, n) => {
      expect(links[n]).toHaveAccessibleName(name);
    });
  });

  it("describes each destination with its figure", async () => {
    const money = (amount: number) => ({ amount, currency: "BRL" });
    const fetch = fakeApi({
      ...sharedRoutes,
      "GET /api/v1/accounts": () =>
        json(200, {
          items: [
            {
              id: "a-1",
              name: "Itaú",
              class: "asset",
              kind: "checking",
              currency: "BRL",
            },
            {
              id: "a-2",
              name: "Reserva",
              class: "asset",
              kind: "reserve",
              currency: "BRL",
            },
            {
              id: "a-3",
              name: "Nubank",
              class: "liability",
              kind: "credit_card",
              currency: "BRL",
            },
          ],
        }),
      "GET /api/v1/balances": () =>
        json(200, {
          items: [
            { account_id: "a-1", balance: money(605480) },
            { account_id: "a-2", balance: money(1000000) },
            { account_id: "a-3", balance: money(-246370) },
          ],
        }),
      "GET /api/v1/goals": () =>
        json(200, {
          items: [
            {
              id: "g-1",
              name: "Japão",
              target: money(2500000),
              due_on: "2027-06-30",
              account_ids: ["a-2"],
              current: money(1600000),
              remaining: money(900000),
              progress_bp: 6400,
            },
          ],
        }),
    });
    await renderApp("/", { width: 1280, fetch });
    const nav = screen.getByRole("navigation", {
      name: catalogEn["nav.label"],
    });
    const link = (key: keyof typeof catalogEn) =>
      within(nav).getByRole("link", { name: catalogEn[key] });
    await waitFor(() => {
      expect(link("nav.overview")).toHaveAccessibleDescription("R$6,054.80");
    });
    expect(link("nav.cards")).toHaveAccessibleDescription("R$2,463.70");
    expect(link("nav.accounts")).toHaveAccessibleDescription("R$13,591.10");
    await waitFor(() => {
      expect(link("nav.goals")).toHaveAccessibleDescription("64%");
    });
  });

  it("opens goals from the more sheet", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["nav.goals"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/goals");
    });
  });

  it("opens accounts from the more sheet", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["nav.accounts"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/accounts");
    });
  });

  it("opens settings from the more sheet", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.settings"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings");
    });
  });
});

describe("AppFrame user menu", () => {
  it("holds settings, colour scheme, language and log out at 1280 px", async () => {
    const user = userEvent.setup();
    await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([catalogEn["more.settings"], catalogEn["more.logout"]]);
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual([
      catalogEn["scheme.dark"],
      catalogEn["scheme.light"],
      catalogEn["scheme.system"],
      catalogEn["locale.en"],
      catalogEn["locale.pt-BR"],
    ]);
    await user.click(
      within(menu).getByRole("menuitemradio", {
        name: catalogEn["scheme.light"],
      }),
    );
    expect(html).toHaveAttribute("data-slotted-scheme", "light");
  });

  it("opens settings from the user menu", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.settings"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings");
    });
  });
});

describe("AppProviders locale", () => {
  it("sets html lang from the stored locale on first load", async () => {
    localStorage.setItem("equori.locale", "pt-BR");
    await renderApp("/", { width: 360, fetch: newFetch() });
    expect(html).toHaveAttribute("lang", "pt-BR");
  });

  it("sets html lang to en when no locale is stored", async () => {
    await renderApp("/", { width: 360, fetch: newFetch() });
    expect(html).toHaveAttribute("lang", "en");
  });
});
