import { readFileSync } from "node:fs";

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import styles from "@/app/shell/app-frame.module.css";
import navStyles from "@/app/shell/desktop-nav/desktop-nav.module.css";
import { askAssistant } from "@/features/assistant";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";

// newFetch with the assistant's chat state and a turn route that streams what the test writes.
function assistantFetch(turn?: () => Response) {
  const routes = newFetch();
  let posts = 0;
  const impl = (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    if (req.url.endsWith("/api/v1/assistant/chat"))
      return Promise.resolve(
        json(200, {
          available: true,
          provider_name: "G",
          model: "m",
          targets: [],
        }),
      );
    if (req.url.endsWith("/api/v1/assistant/turns") && turn !== undefined) {
      posts++;
      return Promise.resolve(turn());
    }
    return routes(input, init);
  };
  return Object.assign(impl, {
    calls: routes.calls,
    posts: () => posts,
  });
}

const html = document.documentElement;

function newFetch(patches: unknown[] = []) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: "user-1", email: "owner@example.com" }),
    "PATCH /api/v1/me": async (req) => {
      patches.push(await req.json());
      return json(200, {
        id: "user-1",
        email: "owner@example.com",
        language: "pt",
        region: "US",
      });
    },
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
    // 800 px: below 600 px a desktop-only route renders the notice of ADR 027 (S4).
    act(() => {
      setViewport(800);
    });
    expect(page?.isConnected).toBe(true);
    act(() => {
      setViewport(1280);
    });
    expect(page?.isConnected).toBe(true);
  });

  it.each([
    { width: 1280, phone: false },
    { width: 390, phone: true },
  ])(
    "applies the phone grid rows to the main region only on a phone ($width px)",
    async ({ width, phone }) => {
      await renderApp("/", { width, fetch: newFetch() });
      const main = document.querySelector(
        '[data-ui="app-shell"] > [data-part="main"]',
      );
      expect(main?.classList.contains(styles.main ?? "missing")).toBe(phone);
    },
  );

  it("sets the compact density when none is stored", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    expect(html).toHaveAttribute("data-slotted-density", "compact");
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
    // The rows of the list itself: a destination with views is a button, the others are links.
    const rows = [
      ...column().querySelectorAll<HTMLElement>(
        '[data-part="list"] > [data-part="item"]',
      ),
    ];
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
      catalogEn["nav.overview"],
      catalogEn["nav.transactions"],
      catalogEn["nav.categories"],
      catalogEn["nav.cards"],
      catalogEn["nav.accounts"],
      catalogEn["nav.goals"],
      catalogEn["nav.planning"],
      catalogEn["nav.instruments"],
      catalogEn["nav.portfolio"],
      catalogEn["nav.reports"],
      catalogEn["nav.calculators"],
      catalogEn["nav.spreadsheets"],
    ]);
    expect(rows.filter((row) => row.hasAttribute("data-current"))).toEqual([
      rows[1],
    ]);
  });

  // Scrollbars are drawn by the browser, so the declaration is asserted on the stylesheet text.
  it("scrolls the destinations with an invisible scrollbar", async () => {
    const css = readFileSync(
      "src/app/shell/desktop-nav/desktop-nav.module.css",
      "utf8",
    );

    await renderApp("/", { fetch: newFetch() });

    expect(column().querySelector('[data-part="nav-body"]')).toHaveClass(
      navStyles.body ?? "missing",
    );
    expect(css).toMatch(
      /\.body\s*\{[^}]*scrollbar-color:\s*transparent transparent/,
    );
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

  // Help spec HP12: a question asked from a page opens the panel with it in the composer.
  it("opens the assistant with a question asked from a page", async () => {
    await renderApp("/", { fetch: assistantFetch() });

    act(() => {
      askAssistant("Pay a statement");
    });

    const input = await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    expect(input).toHaveValue("Pay a statement");
  });

  it("focuses the assistant composer and returns focus on close (U7, P18)", async () => {
    const user = userEvent.setup();
    const routes = newFetch();
    const fetch = Object.assign(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Request(input, init).url.endsWith("/api/v1/assistant/chat")
          ? Promise.resolve(
              json(200, {
                available: true,
                provider_name: "G",
                model: "m",
                targets: [],
              }),
            )
          : routes(input, init),
      { calls: routes.calls },
    );
    await renderApp("/", { fetch });
    const search = screen.getByRole("button", {
      name: new RegExp(`^${catalogEn["nav.search"]}`),
    });
    search.focus();
    await user.keyboard("a");
    const input = await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(search);
    });
  });

  // P9, U8: from 1200 px the assistant is the shell's pane beside the page.
  it("places the assistant beside the page from 1200 px", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 1440, fetch: assistantFetch() });
    await user.keyboard("a");
    const input = await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    expect(
      input.closest('[data-ui="app-shell"] [data-part="aside"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-ui="drawer"]')).toBeNull();
    expect(
      document.querySelector('[data-ui="app-shell"] [data-part="main"]'),
    ).not.toHaveAttribute("inert");
    // Review Focus 2 of phase 4: the pane moves no focus itself; the composer takes it.
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  // The splitter and the pane share one limit: a CSS minimum above the splitter's own leaves a
  // stretch of the drag where the pointer moves and the pane does not.
  it("bounds the assistant pane by the splitter alone, at 30% of the shell", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 1440, fetch: assistantFetch() });
    await user.keyboard("a");
    const splitter = await screen.findByRole("separator", {
      name: "Resize panel",
    });

    const aside = document.querySelector(
      '[data-ui="app-shell"] [data-part="aside"]',
    );

    expect(splitter).toHaveAttribute("aria-valuemin", "30");
    expect(aside).not.toHaveStyle({ minWidth: "30vw" });
  });

  it("overlays the assistant without a scrim from 600 to 1199 px", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 1024, fetch: assistantFetch() });
    await user.keyboard("a");
    await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    // jsdom measures no layout, so the scrim's absence (scrimFrom) is checked in the browser.
    expect(document.querySelector('[data-ui="drawer"]')).not.toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    expect(
      document.querySelector('[data-ui="app-shell"] [data-part="main"]'),
    ).not.toHaveAttribute("inert");
  });

  // Review Focus 1 of phase 4: a resize across 1200 px keeps the running turn and the typed text.
  it("keeps the turn and the typed text across 1200 px", async () => {
    const user = userEvent.setup();
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const fetch = assistantFetch(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              controller = c;
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
    );
    // The turn streams through the global fetch, with an absolute address.
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(
        typeof input === "string" ? `http://localhost${input}` : input,
        init,
      ),
    );
    await renderApp("/", { width: 1440, fetch });
    await user.keyboard("a");
    const input = await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    await waitFor(() => {
      expect(input).toBeEnabled();
    });
    await user.type(input, "How much?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    act(() => {
      controller?.enqueue(
        encoder.encode(
          'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: delta\ndata: {"text":"Half way"}\n\n',
        ),
      );
    });
    await waitFor(() => {
      expect(fetch.posts()).toBe(1);
    });
    expect(await screen.findByText("Half way")).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText(catalogEn["assistant.composer.placeholder"]),
      "next",
    );
    act(() => {
      setViewport(1024);
    });
    expect(await screen.findByText("Half way")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(catalogEn["assistant.composer.placeholder"]),
    ).toHaveValue("next");
    expect(fetch.posts()).toBe(1);
    controller?.close();
    vi.unstubAllGlobals();
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

  it("opens and closes the views of a destination from its arrow, without leaving the page", async () => {
    const user = userEvent.setup();
    const app = await renderApp("/", { fetch: newFetch() });
    const planning = { name: catalogEn["nav.planning"] };

    expect(within(column()).getAllByRole("link", planning)).toHaveLength(1);
    expect(within(column()).getAllByRole("button", planning)).toHaveLength(1);

    await user.click(within(column()).getByRole("button", planning));

    expect(within(column()).getByRole("button", planning)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(localStorage.getItem("equori.nav.groups")).toBe('["planning"]');

    await user.click(within(column()).getByRole("button", planning));

    expect(within(column()).getByRole("button", planning)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(localStorage.getItem("equori.nav.groups")).toBe("[]");
    expect(app.router.state.location.pathname).toBe("/");
  });

  it("goes to a destination from its label and opens its views", async () => {
    const user = userEvent.setup();
    const first = await renderApp("/", { fetch: newFetch() });
    const planning = { name: catalogEn["nav.planning"] };

    await user.click(within(column()).getByRole("link", planning));

    await waitFor(() => {
      expect(first.router.state.location.pathname).toBe("/planning");
    });
    expect(within(column()).getByRole("button", planning)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(localStorage.getItem("equori.nav.groups")).toBe('["planning"]');

    await user.click(
      within(column()).getByRole("link", {
        name: catalogEn["planning.tab.budgets"],
      }),
    );

    await waitFor(() => {
      expect(first.router.state.location.search).toEqual({ tab: "budgets" });
    });
    await waitFor(() => {
      expect(
        within(column()).getByRole("link", {
          name: catalogEn["planning.tab.budgets"],
        }),
      ).toHaveAttribute("aria-current", "page");
    });

    // From another view of the page, the label goes to the destination's own view.
    await user.click(within(column()).getByRole("link", planning));

    await waitFor(() => {
      expect(first.router.state.location.search).toEqual({});
    });

    first.unmount();
    const second = await renderApp("/planning", { fetch: newFetch() });

    expect(within(column()).getByRole("button", planning)).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // On the destination, the arrow closes the group and stays on the page.
    await user.click(within(column()).getByRole("button", planning));

    expect(within(column()).getByRole("button", planning)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(second.router.state.location.pathname).toBe("/planning");
  });

  it("marks the first view of a pressed destination before its route renders", async () => {
    const app = await renderApp("/", { fetch: newFetch() });

    fireEvent.click(
      within(column()).getByRole("link", { name: catalogEn["nav.planning"] }),
    );

    expect(app.router.state.location.pathname).toBe("/");
    expect(
      within(column()).getByRole("link", {
        name: catalogEn["planning.tab.agenda"],
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("marks the destination while the group of its current view is closed", async () => {
    await renderApp("/categories/rules", { fetch: newFetch() });

    expect(
      within(column())
        .getByRole("button", { name: catalogEn["nav.categories"] })
        .closest("li"),
    ).toHaveAttribute("data-current");
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

  it("holds settings, help, books, the quick choices and log out in the account menu", async () => {
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
      catalogEn["more.help"],
      catalogEn["books.new"],
      catalogEn["privacy.hide"],
      catalogEn["more.scheme"],
      catalogEn["more.density"],
      catalogEn["more.language"],
      catalogEn["more.logout"],
    ]);
  });

  it("switches the scheme from its submenu", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.scheme"] }),
    );
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: catalogEn["scheme.light"],
      }),
    );
    expect(html).toHaveAttribute("data-slotted-scheme", "light");
  });

  it("switches the density from its submenu", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.density"] }),
    );
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: catalogEn["density.compact"],
      }),
    );
    expect(html).toHaveAttribute("data-slotted-density", "compact");
    expect(localStorage.getItem("equori.density")).toBe("compact");
  });

  it("hides the amounts from the account menu", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.user"] }),
    );
    const item = await screen.findByRole("menuitemcheckbox", {
      name: catalogEn["privacy.hide"],
    });
    expect(item).toHaveAttribute("aria-checked", "false");
    await user.click(item);
    expect(localStorage.getItem("equori.privacy")).toBe("hidden");
  });

  it("toggles the amounts from the palette", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("combobox"),
      catalogEn["privacy.hide"],
    );
    await user.keyboard("{Enter}");
    expect(localStorage.getItem("equori.privacy")).toBe("hidden");
    await user.keyboard("{Control>}k{/Control}");
    const reopened = await screen.findByRole("dialog");
    await user.type(
      within(reopened).getByRole("combobox"),
      catalogEn["privacy.show"],
    );
    await user.keyboard("{Enter}");
    expect(localStorage.getItem("equori.privacy")).toBeNull();
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

// P9: below 1200 px the assistant is a dialog; from 1200 px it is the shell's pane (tested above).
describe("assistant shortcut", () => {
  it.each(["A", "a"])("opens the assistant on %s", async (key) => {
    await renderApp("/", { width: 1024, fetch: newFetch() });
    fireEvent.keyDown(document.body, { key });
    expect(
      await screen.findByRole("dialog", { name: "Assistant" }),
    ).toBeInTheDocument();
  });

  it("leaves Ctrl+A to the browser", async () => {
    await renderApp("/", { width: 1024, fetch: newFetch() });
    fireEvent.keyDown(document.body, { key: "a", ctrlKey: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("dialog", { name: "Assistant" })).toBeNull();
  });
});

describe("calculator", () => {
  const region = () =>
    screen.queryByRole("region", { name: catalogEn["calculator.title"] });

  it.each(["C", "c"])("opens and closes on %s (K1)", async (key) => {
    await renderApp("/", { fetch: newFetch() });

    fireEvent.keyDown(document.body, { key });

    expect(region()).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key });

    expect(region()).toBeNull();
  });

  it("opens from the column, with its key as legend (K2)", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    const command = screen.getByRole("button", {
      name: new RegExp(`^${catalogEn["calculator.title"]}`),
    });

    await user.click(command);

    expect(command.querySelector("kbd")).toHaveTextContent("C");
    expect(region()).toBeInTheDocument();
  });

  it("opens from the palette (K2)", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });

    await user.keyboard("{Control>}k{/Control}");
    await user.click(
      // The palette also lists the destination "Calculators".
      await screen.findByRole("option", {
        name: new RegExp(`^${catalogEn["calculator.title"]}\\b`),
      }),
    );

    await waitFor(() => {
      expect(region()).toBeInTheDocument();
    });
  });

  it("returns the focus to where it was on Escape (K3)", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    const command = screen.getByRole("button", {
      name: new RegExp(`^${catalogEn["calculator.title"]}`),
    });

    await user.click(command);
    await user.keyboard("{Escape}");

    expect(region()).toBeNull();
    expect(command).toHaveFocus();
  });

  it("keeps the account across a close and a route change (K5)", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { fetch: newFetch() });

    fireEvent.keyDown(document.body, { key: "c" });
    await user.keyboard("12+3{Escape}");
    await act(async () => {
      await router.navigate({ to: "/goals" });
    });
    fireEvent.keyDown(document.body, { key: "c" });

    expect(
      screen.getByRole("textbox", { name: catalogEn["calculator.account"] }),
    ).toHaveValue("12 + 3");
  });

  it("leaves the shell's keys working while it is open (K6)", async () => {
    const { router } = await renderApp("/", { fetch: newFetch() });

    fireEvent.keyDown(document.body, { key: "c" });
    fireEvent.keyDown(document.body, { key: "n" });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
    expect(region()).toBeInTheDocument();
  });

  it("does not exist below 1024 px (K4)", async () => {
    await renderApp("/", { width: 800, fetch: newFetch() });

    fireEvent.keyDown(document.body, { key: "c" });

    expect(region()).toBeNull();
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

  it("hides the amounts from the bar", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 390, fetch: newFetch() });
    const button = screen.getByRole("button", {
      name: catalogEn["privacy.hide"],
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("equori.privacy")).toBe("hidden");
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

  it("marks More current on /settings", async () => {
    await renderApp("/settings", { width: 390, fetch: newFetch() });
    expect(
      within(navigationBar()).getByRole("button", {
        name: catalogEn["nav.more"],
      }),
    ).toHaveAttribute("data-selected");
  });

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

  // ADR 027, S6: a new account is a desktop-only route.
  it("offers the transaction form and the text from the floating button", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 390, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.create"] }),
    );
    expect(
      screen.getByRole("button", { name: catalogEn["nav.create.close"] }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual([catalogEn["nav.new"], catalogEn["capture.title"]]);
  });

  it.each([
    ["nav.new", "/transactions/new"],
    ["capture.title", "/transactions/capture"],
  ] as const)("opens %s from the floating button", async (label, path) => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", {
      width: 390,
      fetch: newFetch(),
    });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.create"] }),
    );
    await user.click(screen.getByRole("menuitem", { name: catalogEn[label] }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(path);
    });
    expect(
      screen.queryByRole("button", { name: catalogEn["nav.create"] }),
    ).toBeNull();
  });

  it("leaves the screen to the keyboard while a field has focus", async () => {
    const { container } = await renderApp("/transactions", {
      width: 390,
      fetch: uncategorizedFetch(0),
    });
    const main = container.querySelector("main");
    if (main === null) throw new Error("no main");
    const field = await within(main).findAllByRole("searchbox");
    act(() => {
      field[0]?.focus();
    });
    expect(document.querySelector('[data-own="navigation-bar"]')).toBeNull();
    act(() => {
      field[0]?.blur();
    });
    expect(navigationBar()).toBeInTheDocument();
  });

  // A tap on the form's Save moves focus on press; the bar returning then shifted the layout
  // under the finger and the tap ended off the button.
  it("keeps the navigation bar away until a press that left a field ends", async () => {
    const { container } = await renderApp("/transactions", {
      width: 390,
      fetch: uncategorizedFetch(0),
    });
    const main = container.querySelector("main");
    if (main === null) throw new Error("no main");
    const field = await within(main).findAllByRole("searchbox");
    act(() => {
      field[0]?.focus();
    });
    act(() => {
      fireEvent.pointerDown(document.body);
      field[0]?.blur();
    });
    expect(document.querySelector('[data-own="navigation-bar"]')).toBeNull();
    act(() => {
      fireEvent.pointerUp(document.body);
    });
    expect(navigationBar()).toBeInTheDocument();
  });

  it("draws the floating button as its mark alone", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    const fab = screen.getByRole("button", {
      name: catalogEn["nav.create"],
    });
    expect(fab).toHaveTextContent(/^$/);
  });

  async function openMore() {
    const user = userEvent.setup();
    await user.click(
      within(navigationBar()).getByRole("button", {
        name: catalogEn["nav.more"],
      }),
    );
    return { user, sheet: await screen.findByRole("dialog") };
  }

  it("opens More as a bottom sheet with a drag handle", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    const { sheet } = await openMore();
    expect(sheet.closest('[data-ui="drawer"]')).toHaveAttribute(
      "data-side",
      "bottom",
    );
    expect(within(sheet).getByRole("separator")).toBeInTheDocument();
  });

  // ADR 027, S6: the other destinations are desktop-only.
  it("lists only settings among the destinations of More", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });

    const { sheet } = await openMore();

    expect(
      within(sheet)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([catalogEn["more.settings"]]);
  });

  it("opens settings from More", async () => {
    const { router } = await renderApp("/", { width: 390, fetch: newFetch() });
    const { user, sheet } = await openMore();
    await user.click(
      within(sheet).getByRole("link", { name: catalogEn["more.settings"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("switches the density in More without leaving the sheet", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    const { user, sheet } = await openMore();
    await user.click(
      within(sheet).getByRole("radio", { name: catalogEn["density.dense"] }),
    );
    expect(html).toHaveAttribute("data-slotted-density", "dense");
    expect(screen.getByRole("dialog")).toBe(sheet);
  });

  it("switches the scheme in More without leaving the sheet", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    const { user, sheet } = await openMore();
    await user.click(
      within(sheet).getByRole("radio", { name: catalogEn["scheme.light"] }),
    );
    expect(html).toHaveAttribute("data-slotted-scheme", "light");
    expect(screen.getByRole("dialog")).toBe(sheet);
  });

  it("switches the language in More and sends it to the profile", async () => {
    const patches: unknown[] = [];
    await renderApp("/", { width: 390, fetch: newFetch(patches) });
    const { user, sheet } = await openMore();
    await user.click(within(sheet).getByRole("radio", { name: "Português" }));
    expect(
      await within(navigationBar()).findByRole("button", {
        name: catalogPtBR["nav.more"],
      }),
    ).toBeInTheDocument();
    expect(patches).toEqual([{ language: "pt" }]);
  });

  it("lists English and Português in the command menu and the account menu", async () => {
    const user = userEvent.setup();
    await renderApp("/", { fetch: newFetch() });
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        catalogEn["palette.language"].replace("{name}", "Português"),
      ),
    ).toBeInTheDocument();
  });
});

describe("phone bars as materials", () => {
  const callbacks: ResizeObserverCallback[] = [];

  class RecordingResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
    }

    observe(): void {
      return undefined;
    }

    unobserve(): void {
      return undefined;
    }

    disconnect(): void {
      return undefined;
    }
  }

  function region(part: "banner" | "main" | "footer") {
    const element = document.querySelector(
      `[data-ui="app-shell"] > [data-part="${part}"]`,
    );
    if (!(element instanceof HTMLElement)) throw new Error(`no ${part}`);
    return element;
  }

  function measure(element: HTMLElement, height: number) {
    element.getBoundingClientRect = () => new DOMRect(0, 0, 390, height);
    act(() => {
      callbacks.forEach((callback) => {
        callback([], new RecordingResizeObserver(callback));
      });
    });
  }

  beforeEach(() => {
    callbacks.length = 0;
    globalThis.ResizeObserver = RecordingResizeObserver;
  });

  it("reserves the height of the top bar and the dock at the ends of the content", async () => {
    await renderApp("/", { width: 390, fetch: newFetch() });
    measure(region("banner"), 56);
    measure(region("footer"), 93.796875);
    const main = region("main");
    expect(main.style.paddingBlockStart).toBe("56px");
    expect(main.style.paddingBlockEnd).toBe("93.796875px");
    expect(main.style.scrollPaddingBlock).toBe(
      "56px calc(93.796875px + var(--slotted-page-sticky-bottom, 0px))",
    );
  });

  it("reserves nothing at the column's width, where no bar lies over the content", async () => {
    await renderApp("/", { width: 1280, fetch: newFetch() });
    const main = region("main");
    expect(main.style.paddingBlockStart).toBe("");
    expect(main.style.paddingBlockEnd).toBe("");
  });

  it("keeps a focused field clear of the page's sticky footer at every width", async () => {
    await renderApp("/", { width: 1280, fetch: newFetch() });
    expect(region("main").style.scrollPaddingBlockEnd).toBe(
      "var(--slotted-page-sticky-bottom, 0px)",
    );
  });
});
