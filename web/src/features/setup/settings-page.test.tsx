import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Sent {
  route: string;
  body: unknown;
}

interface Options {
  put?: () => Response;
  transactions?: boolean;
  language?: string;
  region?: string;
}

function api(sent: Sent[], options: Options = {}) {
  const {
    put = () => json(200, { base_currency: "EUR" }),
    transactions = false,
    language = "pt",
    region = "BR",
  } = options;
  const record =
    (route: string, answer: (body: unknown) => Response) =>
    async (req: Request) => {
      const body: unknown = await req.json();
      sent.push({ route, body });
      return answer(body);
    };
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language,
        region,
      }),
    "PATCH /api/v1/me": record("PATCH /me", (body) =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        ...(body as object),
      }),
    ),
    "DELETE /api/v1/session": () => {
      sent.push({ route: "DELETE /session", body: null });
      return new Response(null, { status: 204 });
    },
    "GET /api/v1/transactions": () =>
      json(200, {
        items: transactions ? [{ id: 1 }] : [],
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "PUT /api/v1/settings": record("PUT /settings", put),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "EUR", type: "currency", scale: 2, name: "Euro" },
        ],
      }),
  });
}

describe("settings page", () => {
  // The region list holds every region of the catalogue, about 250 options, opened twice; naming
  // them in jsdom takes most of the default timeout on a loaded machine.
  it("names the regions in the active locale and sends the chosen one", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=language", {
      fetch: api(sent),
    });
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Região" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Estados Unidos" }),
    );
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Região" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Portugal" }),
    );
    await waitFor(() => {
      expect(sent).toContainEqual({
        route: "PATCH /me",
        body: { region: "PT" },
      });
    });
    expect(document.documentElement.lang).toBe("pt-PT");
  }, 30_000);

  it("sends the base currency", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=finances", {
      fetch: api(sent),
    });
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Moeda base" }),
    );
    await userEvent.click(await screen.findByRole("option", { name: /^EUR/ }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        route: "PUT /settings",
        body: { base_currency: "EUR" },
      });
    });
  });

  it("shows the catalog message when transactions lock the currency", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=finances", {
      fetch: api(sent, { put: () => problem(409, "settings_locked") }),
    });
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Moeda base" }),
    );
    await userEvent.click(await screen.findByRole("option", { name: /^EUR/ }));
    expect(
      await screen.findByText(/não podem ser alteradas|cannot be changed/),
    ).toBeVisible();
    expect(catalogEn["problem.settings_locked"]).toContain("cannot be changed");
  });

  describe("account", () => {
    it("names the signed-in account and its role", async () => {
      await renderApp("/settings", { fetch: api([]) });
      expect(await screen.findByText("a@b.c")).toBeVisible();
      expect(
        screen.getByText(catalogPtBR["settings.account.role.admin"]),
      ).toBeVisible();
    });

    it("ends the session and returns to the login page", async () => {
      const sent: Sent[] = [];
      await renderApp("/settings", { fetch: api(sent) });
      await userEvent.click(
        await screen.findByRole("button", { name: catalogPtBR["more.logout"] }),
      );
      expect(
        await screen.findByRole("heading", {
          name: catalogPtBR["login.title"],
        }),
      ).toBeVisible();
      expect(sent).toContainEqual({ route: "DELETE /session", body: null });
    });
  });

  describe("sections", () => {
    it("shows one pane at a time and switches it from the navigation", async () => {
      await renderApp("/settings", { fetch: api([]) });
      expect(
        await screen.findByRole("heading", {
          level: 2,
          name: catalogPtBR["settings.account.title"],
        }),
      ).toBeVisible();
      const contents = screen.getByRole("navigation", {
        name: catalogPtBR["settings.contents"],
      });
      await userEvent.click(
        within(contents).getByRole("link", {
          name: catalogPtBR["settings.appearance.title"],
        }),
      );
      expect(
        await screen.findByRole("heading", {
          level: 2,
          name: catalogPtBR["settings.appearance.title"],
        }),
      ).toBeVisible();
      expect(
        screen.queryByRole("heading", {
          level: 2,
          name: catalogPtBR["settings.account.title"],
        }),
      ).toBeNull();
      expect(
        within(contents).getByRole("link", {
          name: catalogPtBR["settings.appearance.title"],
        }),
      ).toHaveAttribute("aria-current", "page");
    });

    it("lists the panes as an index on a phone and returns to it", async () => {
      await renderApp("/settings", { fetch: api([]), width: 390 });
      const contents = await screen.findByRole("navigation", {
        name: catalogPtBR["settings.contents"],
      });
      expect(
        within(contents).getByText(catalogPtBR["settings.summary.privacy"]),
      ).toBeVisible();
      expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
      await userEvent.click(
        within(contents).getByRole("link", {
          name: new RegExp(catalogPtBR["settings.privacy.title"]),
        }),
      );
      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: catalogPtBR["settings.privacy.title"],
        }),
      ).toBeVisible();
      expect(
        screen.queryByRole("navigation", {
          name: catalogPtBR["settings.contents"],
        }),
      ).toBeNull();
      await userEvent.click(
        screen.getByRole("button", { name: catalogPtBR["nav.back"] }),
      );
      expect(
        await screen.findByRole("navigation", {
          name: catalogPtBR["settings.contents"],
        }),
      ).toBeVisible();
    });

    it("lists every section in the page's contents", async () => {
      await renderApp("/settings", { fetch: api([]) });
      const contents = await screen.findByRole("navigation", {
        name: catalogPtBR["settings.contents"],
      });
      expect(
        within(contents)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual([
        catalogPtBR["settings.account.title"],
        catalogPtBR["settings.appearance.title"],
        catalogPtBR["settings.language.title"],
        catalogPtBR["settings.privacy.title"],
        catalogPtBR["settings.ledger.title"],
        catalogPtBR["calendar.title"],
        catalogPtBR["settings.integrations.title"],
        catalogPtBR["settings.market_data.title"],
        catalogPtBR["settings.assistant.title"],
        catalogPtBR["settings.external_access.title"],
        catalogPtBR["settings.data.title"],
      ]);
    });
  });

  describe("privacy", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("hides the amounts through a switch and remembers it", async () => {
      await renderApp("/settings?section=privacy", { fetch: api([]) });
      const toggle = await screen.findByRole("switch", {
        name: catalogPtBR["privacy.hide"],
      });
      expect(toggle).not.toBeChecked();
      await userEvent.click(toggle);
      expect(toggle).toBeChecked();
      expect(localStorage.getItem("equori.privacy")).toBe("hidden");
    });
  });

  describe("format example", () => {
    it("writes the date and the number as the pt-BR locale does", async () => {
      await renderApp("/settings?section=language", { fetch: api([]) });
      const example = await screen.findByRole("group", {
        name: catalogPtBR["settings.language.example"],
      });
      expect(within(example).getByText("17/10/2026")).toBeVisible();
      expect(within(example).getByText("1.234,56")).toBeVisible();
    });

    it("writes the date and the number as the en-US locale does", async () => {
      await renderApp("/settings?section=language", {
        fetch: api([], { language: "en", region: "US" }),
      });
      const example = await screen.findByRole("group", {
        name: catalogEn["settings.language.example"],
      });
      expect(within(example).getByText("10/17/2026")).toBeVisible();
      expect(within(example).getByText("1,234.56")).toBeVisible();
    });
  });

  describe("base currency lock", () => {
    it("states why the currency cannot change once a transaction exists", async () => {
      const sent: Sent[] = [];
      await renderApp("/settings?section=finances", {
        fetch: api(sent, { transactions: true }),
      });
      expect(
        await screen.findByText(catalogPtBR["settings.baseCurrency.locked"]),
      ).toBeVisible();
      await userEvent.click(
        screen.getByRole("combobox", { name: "Moeda base" }),
      );
      expect(screen.queryByRole("option")).toBeNull();
      expect(sent).toEqual([]);
    });

    it("states what the currency is for while it can still change", async () => {
      await renderApp("/settings?section=finances", { fetch: api([]) });
      expect(
        await screen.findByText(catalogPtBR["settings.baseCurrency.help"]),
      ).toBeVisible();
      expect(
        screen.queryByText(catalogPtBR["settings.baseCurrency.locked"]),
      ).toBeNull();
    });
  });
});
