import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
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
  html.removeAttribute("data-slotted-density");
  html.removeAttribute("data-slotted-scheme");
});

describe("AppFrame layout", () => {
  it("keeps the routed page mounted when the width crosses 1024 px", async () => {
    const { container } = await renderApp("/goals", {
      width: 1280,
      fetch: newFetch(),
    });
    const page = container.querySelector("main")?.firstElementChild;
    expect(page).toBeInstanceOf(HTMLElement);
    act(() => {
      setViewport(390);
    });
    expect(page?.isConnected).toBe(true);
    act(() => {
      setViewport(1280);
    });
    expect(page?.isConnected).toBe(true);
  });

  it("sets the comfortable density when none is stored", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    expect(html).toHaveAttribute("data-slotted-density", "comfortable");
  });

  it("sets the stored density", async () => {
    localStorage.setItem("equori.density", "dense");
    await renderApp("/", { width: 390, fetch: newFetch() });
    expect(html).toHaveAttribute("data-slotted-density", "dense");
  });
});

function uncategorizedFetch(count: number) {
  const served: string[] = [];
  const fetch = fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: "user-1", email: "owner@example.com" }),
    "GET /api/v1/transactions": (req) => {
      if (new URL(req.url).searchParams.get("uncategorized") !== "true") {
        return json(200, { items: [] });
      }
      served.push("uncategorized");
      return json(200, {
        items: Array.from({ length: count }, (_, i) => ({ id: String(i) })),
      });
    },
  });
  return Object.assign(fetch, { served });
}

function column() {
  return screen.getByRole("navigation", { name: catalogEn["nav.label"] });
}

describe("desktop column", () => {
  it("lists the destinations in the column", async () => {
    await renderApp("/transactions/abc", { fetch: newFetch() });
    const links = within(column()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      catalogEn["nav.overview"],
      catalogEn["nav.transactions"],
      catalogEn["nav.cards"],
      catalogEn["nav.accounts"],
      catalogEn["nav.goals"],
      catalogEn["nav.admin"],
    ]);
    expect(links[1]).toHaveAttribute("aria-current", "page");
    expect(links.filter((link) => link.hasAttribute("aria-current"))).toEqual([
      links[1],
    ]);
  });

  it("shows the uncategorized count beside Transactions", async () => {
    await renderApp("/", { fetch: uncategorizedFetch(12) });
    const link = within(column()).getByRole("link", {
      name: new RegExp(`^${catalogEn["nav.transactions"]}`),
    });
    await waitFor(() => {
      expect(link).toHaveTextContent(`${catalogEn["nav.transactions"]}12`);
    });
  });

  it("shows no count when nothing is uncategorized", async () => {
    const fetch = uncategorizedFetch(0);
    await renderApp("/", { fetch });
    await waitFor(() => {
      expect(fetch.served).toEqual(["uncategorized"]);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const link = within(column()).getByRole("link", {
      name: catalogEn["nav.transactions"],
    });
    expect(link).toHaveTextContent(
      new RegExp(`^${catalogEn["nav.transactions"]}$`),
    );
  });

  it("navigates from the column", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { fetch: newFetch() });
    await user.click(
      within(column()).getByRole("link", { name: catalogEn["nav.cards"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/cards");
    });
  });

  it("opens the entry from the column", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`^${catalogEn["nav.entry.long"]}`),
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
  });

  it("marks the commands' keys as keyboard input", async () => {
    await renderApp("/", { fetch: newFetch() });
    const entry = screen.getByRole("button", {
      name: new RegExp(`^${catalogEn["nav.entry.long"]}`),
    });
    const search = screen.getByRole("button", {
      name: new RegExp(`^${catalogEn["nav.search"]}`),
    });
    expect(entry.querySelector("kbd")).toHaveTextContent("N");
    expect(search.querySelector("kbd")).toHaveTextContent("K");
  });

  it("collapses the column to the rail and remembers it", async () => {
    const user = userEvent.setup();
    const first = await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.collapse"] }),
    );
    expect(localStorage.getItem("equori.nav")).toBe("rail");
    first.unmount();
    await renderApp("/", { fetch: newFetch() });
    expect(
      screen.getByRole("button", { name: catalogEn["nav.expand"] }),
    ).toBeInTheDocument();
  });

  it("opens the palette with Ctrl+K and goes to a destination", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { fetch: newFetch() });
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("combobox"),
      catalogEn["nav.goals"],
    );
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/goals");
    });
  });

  it("opens the palette from the search control", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`^${catalogEn["nav.search"]}`),
      }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("holds settings, scheme, language and log out in the account menu", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      [...menu.querySelectorAll('[role^="menuitem"]')].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      catalogEn["more.settings"],
      catalogEn["scheme.dark"],
      catalogEn["scheme.light"],
      catalogEn["scheme.system"],
      catalogEn["density.comfortable"],
      catalogEn["density.compact"],
      catalogEn["density.dense"],
      catalogEn["locale.en"],
      catalogEn["locale.pt-BR"],
      catalogEn["more.logout"],
    ]);
    await user.click(
      within(menu).getByRole("menuitemradio", {
        name: catalogEn["scheme.light"],
      }),
    );
    expect(html).toHaveAttribute("data-slotted-scheme", "light");
  });

  it("opens the account menu as wide as its trigger", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    const menu = await screen.findByRole("menu");
    expect(menu.closest("[data-width]")).toHaveAttribute(
      "data-width",
      "anchor",
    );
  });

  it("switches the density from the account menu", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: catalogEn["density.compact"],
      }),
    );
    expect(html).toHaveAttribute("data-slotted-density", "compact");
    expect(localStorage.getItem("equori.density")).toBe("compact");
  });

  it("opens settings from the account menu", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { fetch: newFetch() });
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

describe("entry shortcut", () => {
  it.each(["N", "n"])("opens the new transaction on %s", async (key) => {
    const { router } = await renderApp("/", { fetch: newFetch() });
    fireEvent.keyDown(document.body, { key });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
  });

  it("leaves the key to a field", async () => {
    const { router } = await renderApp("/", { fetch: newFetch() });
    const field = document.createElement("input");
    document.body.append(field);
    fireEvent.keyDown(field, { key: "N" });
    field.remove();
    await act(async () => {
      await router.load();
    });
    expect(router.state.location.pathname).toBe("/");
  });

  it("leaves Ctrl+N to the browser", async () => {
    const { router } = await renderApp("/", { fetch: newFetch() });
    fireEvent.keyDown(document.body, { key: "n", ctrlKey: true });
    await act(async () => {
      await router.load();
    });
    expect(router.state.location.pathname).toBe("/");
  });

  it("ignores the key while the command palette is open", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { fetch: newFetch() });
    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog");
    fireEvent.keyDown(document.body, { key: "N" });
    await act(async () => {
      await router.load();
    });
    expect(router.state.location.pathname).toBe("/");
  });
});

describe("phone top app bar", () => {
  it("has no back control on a top-level destination", async () => {
    await renderApp("/cards", { width: 390, fetch: newFetch() });
    expect(
      screen.queryByRole("button", { name: catalogEn["nav.back"] }),
    ).toBeNull();
  });

  it("goes to the parent destination from a deep link", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/accounts/abc", {
      width: 390,
      fetch: newFetch(),
    });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.back"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/accounts");
    });
  });

  it("goes back in history after an in-app navigation", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/transactions", {
      width: 390,
      fetch: newFetch(),
    });
    await act(async () => {
      await router.navigate({ to: "/transactions/new" });
    });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.back"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions");
    });
    expect(router.history.length).toBe(2);
  });

  it("opens the palette from search", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 390, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.search"] }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

function navigationBar() {
  const bar = document.querySelector('[data-own="navigation-bar"]');
  if (!(bar instanceof HTMLElement)) throw new Error("no navigation bar");
  return bar;
}

describe("phone dock", () => {
  it("shows four tabs and More in the navigation bar", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    const controls = [...navigationBar().querySelectorAll("a, button")];
    expect(controls.map((control) => control.textContent)).toEqual([
      catalogEn["nav.home"],
      catalogEn["nav.transactions"],
      catalogEn["nav.cards"],
      catalogEn["nav.accounts"],
      catalogEn["nav.more"],
    ]);
    expect(document.querySelector('[data-ui="side-navigation"]')).toBeNull();
  });

  it("marks the current tab", async () => {
    await renderApp("/transactions/abc", { width: 390, fetch: newFetch() });
    expect(
      within(navigationBar()).getByRole("link", {
        name: catalogEn["nav.transactions"],
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it.each(["/goals", "/admin", "/settings"])(
    "marks More current on %s",
    async (path) => {
      await renderApp(path, { width: 390, fetch: newFetch() });
      expect(
        within(navigationBar()).getByRole("button", {
          name: catalogEn["nav.more"],
        }),
      ).toHaveAttribute("data-selected");
    },
  );

  it("scrolls to the top on a tap of the current tab", async () => {
    const user = userEvent.setup();
    const { router, container } = await renderApp("/cards", {
      width: 390,
      fetch: newFetch(),
    });
    const main = container.querySelector("main");
    if (main === null) throw new Error("no main");
    const scrolls: unknown[] = [];
    main.scrollTo = (options?: ScrollToOptions | number) => {
      scrolls.push(options);
    };
    await user.click(
      within(navigationBar()).getByRole("link", {
        name: catalogEn["nav.cards"],
      }),
    );
    expect(scrolls).toEqual([{ top: 0, behavior: "smooth" }]);
    expect(router.state.location.pathname).toBe("/cards");
  });

  it("opens the entry from the floating button", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { width: 390, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.entry.long"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
    expect(
      screen.queryByRole("button", { name: catalogEn["nav.entry.long"] }),
    ).toBeNull();
  });

  it.each([
    ["nav.goals", "/goals"],
    ["nav.admin", "/admin"],
    ["more.settings", "/settings"],
  ] as const)("opens %s from More", async (label, path) => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { width: 390, fetch: newFetch() });
    await user.click(
      within(navigationBar()).getByRole("button", {
        name: catalogEn["nav.more"],
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn[label] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(path);
    });
  });

  it("switches the density from More", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 390, fetch: newFetch() });
    await user.click(
      within(navigationBar()).getByRole("button", {
        name: catalogEn["nav.more"],
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.density"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["density.dense"] }),
    );
    expect(html).toHaveAttribute("data-slotted-density", "dense");
  });

  it("switches the scheme from More", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 390, fetch: newFetch() });
    await user.click(
      within(navigationBar()).getByRole("button", {
        name: catalogEn["nav.more"],
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.scheme"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["scheme.light"] }),
    );
    expect(html).toHaveAttribute("data-slotted-scheme", "light");
  });
});
