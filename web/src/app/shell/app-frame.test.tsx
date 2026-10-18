import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { checkingID, sharedRoutes } from "@/testing/transaction-api";
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

// Ledger sheet decisions L4, L5, L7 and L8.
describe("AppFrame navigation", () => {
  it("shows four text controls in the bottom bar at 360 px", async () => {
    const { container } = await renderApp("/", {
      width: 360,
      fetch: newFetch(),
    });
    const bar = container.querySelector('[data-own="bottom-bar"]');
    expect(
      [...(bar?.querySelectorAll("a, button") ?? [])].map(
        (control) => control.textContent,
      ),
    ).toEqual([
      catalogEn["nav.overview"],
      catalogEn["nav.transactions"],
      catalogEn["nav.accounts"],
      catalogEn["nav.more"],
    ]);
    expect(bar?.querySelector("svg")).toBeNull();
    expect(container.querySelector('[data-ui="top-navigation"]')).toBeNull();
    expect(document.querySelector('[data-ui="side-navigation"]')).toBeNull();
    expect(html).toHaveAttribute("data-slotted-density", "comfortable");
  });

  it("draws the shell edge to edge at every width", async () => {
    for (const width of [360, 768, 1280]) {
      const view = await renderApp("/", { width, fetch: newFetch() });
      expect(
        view.container.querySelector('[data-ui="app-shell"]'),
      ).toHaveAttribute("data-canvas", "flush");
      view.unmount();
    }
  });

  it.each([
    [768, "comfortable"],
    [1280, "compact"],
  ] as const)("shows the top bar at %d px", async (width, density) => {
    const { container } = await renderApp("/", { width, fetch: newFetch() });
    const bar = container.querySelector('[data-ui="top-navigation"]');
    expect(bar).not.toBeNull();
    expect(container.querySelector('[data-ui="side-navigation"]')).toBeNull();
    expect(container.querySelector('[data-own="bottom-bar"]')).toBeNull();
    expect(html).toHaveAttribute("data-slotted-density", density);
  });

  it("swaps the bottom bar for the top bar without a reload", async () => {
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
    expect(
      container.querySelector('[data-ui="top-navigation"]'),
    ).not.toBeNull();
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
            link.querySelector('[data-ui="badge"]')?.textContent ?? null,
          ).toBe(badge);
        });
        view.unmount();
      }
    },
  );
});

describe("AppFrame routing", () => {
  it("navigates from the top bar without a reload", async () => {
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

  it("links New to the form, with the open account preselected", async () => {
    const fetch = fakeApi(sharedRoutes);
    const home = await renderApp("/", { width: 1280, fetch });
    expect(
      screen.getByRole("link", { name: new RegExp(catalogEn["nav.entry"]) }),
    ).toHaveAttribute("href", "/transactions/new");
    home.unmount();
    await renderApp(`/accounts/${checkingID}`, { width: 1280, fetch });
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: new RegExp(catalogEn["nav.entry"]) }),
      ).toHaveAttribute("href", `/transactions/new?account_id=${checkingID}`);
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
