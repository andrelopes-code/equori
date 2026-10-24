import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { instrumentsApi as api } from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

describe("Instrument catalog", () => {
  it("lists the instruments by type with the latest price and its date", async () => {
    await renderApp("/instruments", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["instruments.caption"],
    });
    await within(table).findByText("38.45");
    const lines = within(table)
      .getAllByRole("row")
      .map((row) =>
        [...row.querySelectorAll("th, td, [role=gridcell]")]
          .map((cell) => cell.textContent)
          .join("|"),
      );
    const at = (prefix: string) => lines.findIndex((l) => l.startsWith(prefix));
    expect(lines[at("PETR4")]).toBe(
      "PETR4|Petrobras PN||BRL|B3SA|38.45|10/16/2026",
    );
    expect(lines[at("VALE3")]).toBe("VALE3|Vale ON||BRL|B3SA|61.20|10/10/2026");
    expect(lines[at("USD")]).toBe("USD|Dollar||||5.4830|10/16/2026");
    expect(lines[at("CDB1")]).toBe(
      `CDB1|CDB Bank One|cdb|BRL||${catalogEn["instruments.noPrice"]}|`,
    );
    const heading = (type: string) =>
      lines.findIndex(
        (l) => l === catalogEn[`instruments.type.${type}` as never],
      );
    expect(heading("currency")).toBeGreaterThan(-1);
    expect(heading("currency")).toBeLessThan(at("BRL"));
    expect(at("USD")).toBeLessThan(heading("stock"));
    expect(heading("stock")).toBeLessThan(at("PETR4"));
    expect(at("VALE3")).toBeLessThan(heading("fixed_income"));
    expect(heading("fixed_income")).toBeLessThan(at("CDB1"));
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
    await renderApp("/settings", { fetch: api() });
    const link = await screen.findByRole("link", {
      name: catalogEn["settings.ledger.instruments"],
    });
    expect(link).toHaveAttribute("href", "/instruments");
  });
});
