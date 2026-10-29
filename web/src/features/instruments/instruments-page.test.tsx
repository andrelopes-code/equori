import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
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
      "Currencies · 2",
      "BRL|Real|||||",
      "USD|Dollar||||5.4830|10/16/2026",
      "Fixed income · 1",
      `CDB1|CDB Bank One|cdb|BRL||${catalogEn["instruments.noPrice"]}|`,
      "Stocks · 2",
      "PETR4|Petrobras PN||BRL|B3SA|38.45|10/16/2026",
      "VALE3|Vale ON||BRL|B3SA|61.20|10/10/2026",
    ]);
  });

  it("asks for the price of each instrument but not of the base currency", async () => {
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
      expect(new Set(asked)).toEqual(
        new Set(["USD", "PETR4", "VALE3", "CDB1"]),
      );
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
