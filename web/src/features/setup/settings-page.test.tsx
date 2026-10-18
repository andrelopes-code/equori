import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-slotted-scheme");
});

interface Named {
  id: string;
  name: string;
}

function settingsApi(
  opts: { hasTransaction?: boolean; put?: () => Response } = {},
) {
  const captured = {
    puts: [] as unknown[],
    institutions: [] as unknown[],
    payees: [] as unknown[],
  };
  const institutions: Named[] = [{ id: "i-1", name: "Itaú" }];
  const payees: Named[] = [{ id: "p-1", name: "Mercado Sol" }];
  const fetch = fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "PUT /api/v1/settings": async (req) => {
      captured.puts.push(await req.json());
      return opts.put?.() ?? json(200, { base_currency: "USD" });
    },
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
        ],
      }),
    "GET /api/v1/transactions": () =>
      json(200, {
        items: opts.hasTransaction === true ? [{ id: "t-1" }] : [],
      }),
    "GET /api/v1/institutions": () => json(200, { items: institutions }),
    "POST /api/v1/institutions": async (req) => {
      const body = (await req.json()) as { name: string };
      captured.institutions.push(body);
      const created = { id: "i-2", name: body.name };
      institutions.push(created);
      return json(201, created);
    },
    "GET /api/v1/payees": () => json(200, { items: payees }),
    "POST /api/v1/payees": async (req) => {
      const body = (await req.json()) as { name: string };
      captured.payees.push(body);
      const created = { id: "p-2", name: body.name };
      payees.push(created);
      return json(201, created);
    },
  });
  return { fetch, captured };
}

async function pick(
  actor: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
) {
  await actor.click(await screen.findByRole("combobox", { name }));
  await actor.click(await screen.findByRole("option", { name: option }));
}

describe("settings: base currency", () => {
  it("sends the chosen currency with PUT /settings", async () => {
    const actor = userEvent.setup();
    const { fetch, captured } = settingsApi();
    await renderApp("/settings", { fetch });
    await pick(actor, catalogEn["settings.currency.label"], "USD");
    await waitFor(() => {
      expect(captured.puts).toEqual([{ base_currency: "USD" }]);
    });
  });

  it("locks the select and shows the reason after a 409 settings_locked", async () => {
    const actor = userEvent.setup();
    const { fetch } = settingsApi({
      put: () => problem(409, "settings_locked"),
    });
    await renderApp("/settings", { fetch });
    await pick(actor, catalogEn["settings.currency.label"], "USD");
    expect(
      await screen.findByText(catalogEn["problem.settings_locked"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: catalogEn["settings.currency.label"],
      }),
    ).toBeDisabled();
  });

  it("disables the select before any attempt when a transaction exists", async () => {
    const { fetch, captured } = settingsApi({ hasTransaction: true });
    await renderApp("/settings", { fetch });
    expect(
      await screen.findByText(catalogEn["problem.settings_locked"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: catalogEn["settings.currency.label"],
      }),
    ).toBeDisabled();
    expect(captured.puts).toEqual([]);
  });
});

describe("settings: institutions and payees", () => {
  it("lists institutions and creates one with POST /institutions", async () => {
    const actor = userEvent.setup();
    const { fetch, captured } = settingsApi();
    await renderApp("/settings", { fetch });
    expect(await screen.findByText("Itaú")).toBeInTheDocument();
    await actor.click(
      screen.getByRole("button", {
        name: catalogEn["settings.institutions.new"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await actor.type(
      within(dialog).getByLabelText(catalogEn["settings.field.name"], {
        exact: false,
      }),
      "Nubank",
    );
    await actor.click(
      within(dialog).getByRole("button", {
        name: catalogEn["settings.create.submit"],
      }),
    );
    expect(await screen.findByText("Nubank")).toBeInTheDocument();
    expect(captured.institutions).toEqual([{ name: "Nubank" }]);
  });

  it("lists payees and creates one with POST /payees", async () => {
    const actor = userEvent.setup();
    const { fetch, captured } = settingsApi();
    await renderApp("/settings", { fetch });
    expect(await screen.findByText("Mercado Sol")).toBeInTheDocument();
    await actor.click(
      screen.getByRole("button", { name: catalogEn["settings.payees.new"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await actor.type(
      within(dialog).getByLabelText(catalogEn["settings.field.name"], {
        exact: false,
      }),
      "Padaria Lua",
    );
    await actor.click(
      within(dialog).getByRole("button", {
        name: catalogEn["settings.create.submit"],
      }),
    );
    expect(await screen.findByText("Padaria Lua")).toBeInTheDocument();
    expect(captured.payees).toEqual([{ name: "Padaria Lua" }]);
  });
});

describe("settings: display", () => {
  it("switches the language, stores it and updates <html lang>", async () => {
    const actor = userEvent.setup();
    const { fetch } = settingsApi();
    await renderApp("/settings", { fetch });
    await pick(actor, catalogEn["more.language"], catalogEn["locale.pt-BR"]);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogPtBR["more.settings"],
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("equori.locale")).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("applies and stores the chosen colour scheme", async () => {
    const actor = userEvent.setup();
    const { fetch } = settingsApi();
    await renderApp("/settings", { fetch });
    await pick(actor, catalogEn["more.scheme"], catalogEn["scheme.light"]);
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(
        "data-slotted-scheme",
        "light",
      );
    });
    expect(localStorage.getItem("equori.scheme")).toBe("light");
  });
});

describe("settings: layout", () => {
  it.each([360, 1280])("keeps the measure width at %i px", async (width) => {
    const { fetch } = settingsApi();
    const { container } = await renderApp("/settings", { width, fetch });
    await screen.findByText("Itaú");
    expect(container.querySelector("[data-width]")).toHaveAttribute(
      "data-width",
      "measure",
    );
  });
});
