import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
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

describe("AppFrame navigation", () => {
  // Below 1024 px a bottom bar of five controls, New in the middle.
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
      expect(controls[2]).toHaveAttribute("data-emphasis", "primary");
      expect(controls[2]?.tagName).toBe("BUTTON");
      expect(bar?.querySelectorAll("svg")).toHaveLength(5);
      expect(container.querySelector('[data-own="top-bar"]')).toBeNull();
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

  // From 1024 px the destinations stand in a top bar in the shell's banner.
  it("shows the top bar in the banner at 1280 px", async () => {
    const { container } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    const bar = container.querySelector('[data-own="top-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.closest("header")).not.toBeNull();
    expect(container.querySelector('[data-own="bottom-bar"]')).toBeNull();
    expect(container.querySelector('[data-ui="top-navigation"]')).toBeNull();
    expect(container.querySelector('[data-ui="app-shell"] > nav')).toBeNull();
  });

  // The month switcher belongs to Overview only.
  it("holds no month switcher in the top bar away from Overview", async () => {
    const { container } = await renderApp("/accounts", {
      width: 1280,
      fetch: newFetch(),
    });
    expect(container.querySelector('[data-own="top-bar"]')).not.toBeNull();
    expect(container.querySelector('[data-own="month-switcher"]')).toBeNull();
  });

  it("brings the top bar back after the window narrows and widens again", async () => {
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
      expect(container.querySelector('[data-own="top-bar"]')).not.toBeNull();
    });
    expect(
      container.querySelector('[data-ui="app-shell"]'),
    ).not.toHaveAttribute("data-open");
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
    expect(container.querySelector('[data-own="top-bar"]')).not.toBeNull();
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
            link.querySelector('[data-own="nav-count"], [data-own="bar-count"]')
              ?.textContent ?? null,
          ).toBe(badge);
        });
        // A discreet count in the secondary tone.
        if (badge !== null) {
          expect(link.querySelector('[data-ui="badge"]')).toHaveAttribute(
            "data-tone",
            "secondary",
          );
        }
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
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/accounts");
    });
  });

  // The top bar's links select before the route changes, as the tab bar's do.
  it("selects the clicked destination before the route changes", async () => {
    const { router } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    const accounts = screen.getByRole("link", {
      name: catalogEn["nav.accounts"],
    });
    fireEvent.click(accounts);
    expect(accounts).toHaveAttribute("data-selected");
    expect(
      screen.getByRole("link", { name: catalogEn["nav.overview"] }),
    ).not.toHaveAttribute("data-selected");
    expect(router.state.location.pathname).toBe("/");
    await waitFor(() => {
      expect(accounts).toHaveAttribute("aria-current", "page");
    });
  });

  // A tap on the selected tab at its own route scrolls the page to its top.
  it.each([360, 1280])(
    "scrolls the page to its top on a tap on the current destination at %i px",
    async (width) => {
      // jsdom does not scroll; this stand-in moves scrollTop as a browser would.
      const scrollTo = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "scrollTo",
      );
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value(this: HTMLElement, options?: ScrollToOptions) {
          this.scrollTop = options?.top ?? 0;
        },
      });
      try {
        const { container, router } = await renderApp("/transactions", {
          width,
          fetch: newFetch(),
        });
        const main = container.querySelector("main");
        if (main === null) throw new Error("no main");
        main.scrollTop = 400;
        fireEvent.click(
          screen.getByRole("link", {
            name: new RegExp(`^${catalogEn["nav.transactions"]}`),
          }),
        );
        expect(main.scrollTop).toBe(0);
        expect(router.state.location.pathname).toBe("/transactions");
      } finally {
        if (scrollTo === undefined) {
          Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
        } else {
          Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollTo);
        }
      }
    },
  );

  it("marks Transactions current on a transaction detail route", async () => {
    await renderApp("/transactions/abc", { width: 1280, fetch: newFetch() });
    expect(
      screen.getByRole("link", { name: catalogEn["nav.transactions"] }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: catalogEn["nav.overview"] }),
    ).not.toHaveAttribute("aria-current");
  });

  // The entry opens the admin page until the quick entry is rebuilt.
  it("opens the admin page from the top bar's entry control", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", {
      width: 1280,
      fetch: fakeApi(sharedRoutes),
    });
    const entry = screen.getByRole("button", {
      name: new RegExp(`^${catalogEn["nav.entry.long"]}`),
    });
    // A neutral field trigger, the label at the start and the key at the
    // end.
    expect(entry).toHaveAttribute("data-own", "entry-trigger");
    expect(entry.firstElementChild).toHaveTextContent(
      catalogEn["nav.entry.long"],
    );
    expect(entry.lastElementChild).toHaveAttribute("data-ui", "kbd");
    const css = readFileSync("src/app/shell/top-bar.module.css", "utf8");
    const rule = /\.entry\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).toContain("justify-content: space-between");
    expect(rule).not.toContain("tone-accent");
    await user.click(entry);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin");
    });
  });

  // The temporary admin page stands last.
  it("lists Overview, Transactions, Goals, Cards, Accounts and Admin in the top bar", async () => {
    await renderApp("/", { width: 1280, fetch: newFetch() });
    const nav = screen.getByRole("navigation", {
      name: catalogEn["nav.label"],
    });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(6);
    [
      catalogEn["nav.overview"],
      catalogEn["nav.transactions"],
      catalogEn["nav.goals"],
      catalogEn["nav.cards"],
      catalogEn["nav.accounts"],
      catalogEn["nav.admin"],
    ].forEach((name, n) => {
      expect(links[n]).toHaveAccessibleName(name);
    });
  });

  it("writes no figure beside a destination", async () => {
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
          ],
        }),
      "GET /api/v1/balances": () =>
        json(200, { items: [{ account_id: "a-1", balance: money(605480) }] }),
    });
    await renderApp("/admin", { width: 1280, fetch });
    expect((await screen.findAllByText("6054.80 BRL")).length).toBeGreaterThan(
      0,
    );
    const nav = screen.getByRole("navigation", {
      name: catalogEn["nav.label"],
    });
    for (const link of within(nav).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-describedby");
    }
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

  it("opens admin from the more sheet", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["nav.admin"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin");
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
