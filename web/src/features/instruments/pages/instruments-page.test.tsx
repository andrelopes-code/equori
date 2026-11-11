import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { formatPrice } from "@/features/instruments/model/rate";
import { catalogEn } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { json, problem } from "@/testing/fake-api";
import { instrumentsApi as api } from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

const gridRows = (grid: HTMLElement) =>
  within(grid)
    .getAllByRole("row")
    .map(
      (row) =>
        [
          ...row.querySelectorAll(
            '[role="rowheader"], [role="gridcell"], [role="columnheader"]',
          ),
        ]
          .map((cell) => cell.textContent)
          .join("|") || row.textContent,
    );

describe("Instrument catalog", () => {
  it("lists the instruments by type with the latest price and its date", async () => {
    await renderApp("/instruments", { fetch: api() });
    const grid = await screen.findByRole("grid", {
      name: catalogEn["instruments.caption"],
    });
    await within(grid).findByText("38.45");
    expect(gridRows(grid)).toEqual([
      "Code|Name|Subtype|Quote currency|Exchange|Latest price|Price date",
      "Fixed income · 1",
      `CDB1|CDB Bank One|cdb|BRL||${catalogEn["instruments.noPrice"]}|`,
      "Stocks · 2",
      "PETR4|Petrobras PN||BRL|B3SA|38.45|10/16/2026",
      "VALE3|Vale ON||BRL|B3SA|61.20|10/10/2026",
      "Currencies · 2",
    ]);
  });

  it("PC20: opens the currencies on request and reads their prices then", async () => {
    await renderApp("/instruments", { fetch: api() });
    const grid = await screen.findByRole("grid", {
      name: catalogEn["instruments.caption"],
    });
    await within(grid).findByText("38.45");

    await userEvent
      .setup()
      .click(within(grid).getByRole("button", { name: /Currencies/ }));

    expect(await within(grid).findByText("5.4830")).toBeInTheDocument();
  });

  it("asks for the price of each security on screen, and of no closed currency", async () => {
    const asked: string[] = [];
    const fetch = api({
      "GET /api/v1/prices": (req) => {
        asked.push(new URL(req.url).searchParams.get("instrument") ?? "");
        return json(200, { items: [] });
      },
    });
    await renderApp("/instruments", { fetch });
    await screen.findByRole("grid", { name: catalogEn["instruments.caption"] });
    await waitFor(() => {
      expect(new Set(asked)).toEqual(new Set(["PETR4", "VALE3", "CDB1"]));
    });
  });

  it("opens the instrument from its row", async () => {
    const { router } = await renderApp("/instruments", { fetch: api() });
    const user = userEvent.setup();
    await user.dblClick(await screen.findByText("Petrobras PN"));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/instruments/PETR4");
    });
  });

  it("links the code of a row to its instrument", async () => {
    await renderApp("/instruments", { fetch: api() });
    expect(await screen.findByRole("link", { name: "PETR4" })).toHaveAttribute(
      "href",
      "/instruments/PETR4",
    );
  });

  it("searches the instruments by code or name", async () => {
    await renderApp("/instruments", { fetch: api() });
    const grid = await screen.findByRole("grid", {
      name: catalogEn["instruments.caption"],
    });
    await within(grid).findByText("38.45");
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: catalogEn["instruments.search"] }),
      "petro",
    );
    await waitFor(() => {
      expect(gridRows(grid).slice(1)).toEqual([
        "Stocks · 1",
        "PETR4|Petrobras PN||BRL|B3SA|38.45|10/16/2026",
      ]);
    });
  });

  it("filters the subtype choices by the chosen type and sends the definition", async () => {
    const sent: unknown[] = [];
    const subtypeRequests: string[] = [];
    const fetch = api({
      "GET /api/v1/instrument-subtypes": (req) => {
        const type = new URL(req.url).searchParams.get("type") ?? "";
        subtypeRequests.push(type);
        return json(200, {
          items: type === "fixed_income" ? ["cdb", "lci"] : [],
        });
      },
      "POST /api/v1/instruments": async (req) => {
        sent.push(await req.json());
        return json(201, {
          code: "LCI1",
          type: "fixed_income",
          scale: 2,
          name: "LCI One",
          quote_currency: "BRL",
          subtype: "lci",
        });
      },
    });
    await renderApp("/instruments", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instruments.define"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Code/ }),
      "lci1",
    );
    await user.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["instruments.field.type"],
      }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: catalogEn["instruments.type.fixed_income"],
      }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Decimal places/ }),
      "2",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Name/ }),
      "LCI One",
    );
    await user.click(
      await within(dialog).findByRole("combobox", {
        name: catalogEn["instruments.field.subtype"],
      }),
    );
    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual([catalogEn["instruments.subtype.none"], "cdb", "lci"]);
    await user.click(screen.getByRole("option", { name: "lci" }));
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instruments.save"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          code: "LCI1",
          type: "fixed_income",
          scale: 2,
          name: "LCI One",
          quote_currency: "BRL",
          subtype: "lci",
        },
      ]);
    });
    expect(new Set(subtypeRequests)).toEqual(new Set(["fixed_income"]));
  });

  // A223 RM9
  it("takes the decimal places of the type when none is typed", async () => {
    const sent: unknown[] = [];
    const fetch = api({
      "POST /api/v1/instruments": async (req) => {
        sent.push(await req.json());
        return json(201, {
          code: "BTC",
          type: "crypto",
          scale: 8,
          name: "Bitcoin",
          quote_currency: "BRL",
        });
      },
    });
    await renderApp("/instruments", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instruments.define"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Code/ }),
      "btc",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Name/ }),
      "Bitcoin",
    );
    await user.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["instruments.field.type"],
      }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: catalogEn["instruments.type.crypto"],
      }),
    );

    expect(
      within(dialog).getByRole("textbox", { name: /^Decimal places/ }),
    ).toHaveAttribute("placeholder", "8");

    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instruments.save"],
      }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          code: "BTC",
          type: "crypto",
          scale: 8,
          name: "Bitcoin",
          quote_currency: "BRL",
        },
      ]);
    });
  });

  it("spaces the catalog search through the form column of the define dialog", async () => {
    await renderApp("/instruments", { fetch: api({}) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instruments.define"],
      }),
    );
    const dialog = await screen.findByRole("dialog");

    const search = within(dialog)
      .getByRole("combobox", { name: catalogEn["instruments.search.label"] })
      .closest('[data-ui="field"]');
    const row = within(dialog)
      .getByRole("textbox", { name: /^Code/ })
      .closest('[data-ui="field"]')?.parentElement;

    expect(search?.parentElement).toBe(row?.parentElement);
  });

  it("fills the define dialog from a catalog result", async () => {
    const sent: unknown[] = [];
    const fetch = api({
      "GET /api/v1/market-data/catalog": (req) => {
        expect(new URL(req.url).searchParams.get("q")).toBe("petr");
        return json(200, {
          items: [
            {
              code: "PETR4",
              name: "Petrobras PN",
              type: "stock",
              exchange: "BVMF",
              quote_currency: "BRL",
              symbol: "PETR4.SA",
              source: "yahoo_chart",
              defined: false,
            },
            {
              code: "PETR3",
              name: "",
              exchange: "BVMF",
              quote_currency: "BRL",
              symbol: "",
              source: "b3_consolidated",
              defined: true,
            },
          ],
          unavailable: ["coinbase"],
        });
      },
      "POST /api/v1/instruments": async (req) => {
        sent.push(await req.json());
        return json(201, {});
      },
    });
    await renderApp("/instruments", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instruments.define"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("combobox", {
        name: catalogEn["instruments.search.label"],
      }),
      "petr",
    );
    const chosen = await screen.findByRole("option", { name: /PETR4/ });
    const defined = screen.getByRole("option", { name: /PETR3/ });
    expect(defined).toHaveAttribute("aria-disabled", "true");
    expect(defined).toHaveTextContent(catalogEn["instruments.search.defined"]);
    expect(
      within(dialog).getByText("No answer from: Coinbase"),
    ).toBeInTheDocument();
    await user.click(chosen);
    expect(within(dialog).getByRole("textbox", { name: /^Code/ })).toHaveValue(
      "PETR4",
    );
    expect(
      within(dialog).getByRole("textbox", { name: /^Exchange/ }),
    ).toHaveValue("BVMF");
    expect(within(dialog).getByRole("textbox", { name: /^Name/ })).toHaveValue(
      "Petrobras PN",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Decimal places/ }),
      "0",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instruments.save"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          code: "PETR4",
          type: "stock",
          scale: 0,
          name: "Petrobras PN",
          quote_currency: "BRL",
          exchange: "BVMF",
        },
      ]);
    });
  });

  it("shows what each source quotes for the instrument being defined", async () => {
    const probed: unknown[] = [];
    const fetch = api({
      "POST /api/v1/market-data/probe": async (req) => {
        probed.push(await req.json());
        return json(200, probeResult);
      },
    });
    await renderApp("/instruments", { fetch });
    const dialog = await openProbeForm();

    const base = "B3, consolidated trades";
    expect(
      await within(dialog).findByText(
        `${base}: ${formatPrice("38.5", "en-US")} on ${formatDate("2026-11-06", "en-US")}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Coinbase: no quote for this code"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Tesouro Direto: no answer"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Not enabled: Yahoo Finance"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: catalogEn["instruments.probe.settings"],
      }),
    ).toBeInTheDocument();
    expect(probed).toEqual([
      { code: "PETR4", type: "stock", exchange: "BVMF", quote_currency: "BRL" },
    ]);
  });

  it("hides the sources not enabled and the settings link from a member", async () => {
    const fetch = api({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          books_id: 1,
          role: "member",
          language: "en",
          region: "BR",
        }),
      "POST /api/v1/market-data/probe": () => json(200, probeResult),
    });
    await renderApp("/instruments", { fetch });
    const dialog = await openProbeForm();

    expect(
      await within(dialog).findByText("Coinbase: no quote for this code"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/Not enabled/)).toBeNull();
    expect(
      within(dialog).queryByRole("link", {
        name: catalogEn["instruments.probe.settings"],
      }),
    ).toBeNull();
  });

  it("shows the problem the server returns for a code in use", async () => {
    const fetch = api({
      "POST /api/v1/instruments": () =>
        problem(409, "conflict", {
          errors: [{ field: "code", message: "Code already in use." }],
        }),
    });
    await renderApp("/instruments", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instruments.define"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Code/ }),
      "PETR4",
    );
    await user.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["instruments.field.type"],
      }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: catalogEn["instruments.type.stock"],
      }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Decimal places/ }),
      "0",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Name/ }),
      "Petrobras",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instruments.save"],
      }),
    );
    expect(
      await within(dialog).findByText("Code already in use."),
    ).toBeInTheDocument();
  });

  it("is a destination of the shell and the settings link opens it", async () => {
    await renderApp("/settings?section=finances", { fetch: api() });
    const link = await screen.findByRole("link", {
      name: catalogEn["settings.ledger.instruments"],
    });
    expect(link).toHaveAttribute("href", "/instruments");
  });

  // ADR 027, S6: the instruments are desktop-only.
  it("leaves the settings row out on a phone", async () => {
    await renderApp("/settings?section=finances", { fetch: api(), width: 390 });
    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.queryByRole("link", {
        name: catalogEn["settings.ledger.instruments"],
      }),
    ).toBeNull();
    expect(
      screen.queryByText(catalogEn["settings.ledger.instrumentsDescription"]),
    ).toBeNull();
  });
});

const probeResult = {
  quotes: [
    {
      source: "b3_consolidated",
      date: "2026-11-06",
      value: "38.5",
      error: null,
    },
    { source: "coinbase", date: null, value: null, error: null },
    { source: "tesouro_direto", date: null, value: null, error: "status 500" },
  ],
  available: ["yahoo_chart"],
};

async function openProbeForm() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", {
      name: catalogEn["instruments.define"],
    }),
  );
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("combobox", {
      name: catalogEn["instruments.field.type"],
    }),
  );
  await user.click(
    await screen.findByRole("option", {
      name: catalogEn["instruments.type.stock"],
    }),
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: /^Code/ }),
    "PETR4",
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: /^Exchange/ }),
    "BVMF",
  );
  return dialog;
}
