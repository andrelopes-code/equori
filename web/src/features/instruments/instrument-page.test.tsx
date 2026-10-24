import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { instrumentsApi as api } from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td, [role=gridcell]")]
        .map((cell) => cell.textContent)
        .join("|"),
    );

describe("Instrument page", () => {
  it("shows the instrument and its prices of the last 90 days with the source of each", async () => {
    const queries: URLSearchParams[] = [];
    const fetch = api({
      "GET /api/v1/prices": (req) => {
        queries.push(new URL(req.url).searchParams);
        return json(200, {
          items: [
            {
              instrument: "PETR4",
              quote_instrument: "BRL",
              date: "2026-10-14",
              value: "38.10",
              source: "b3_cotahist",
            },
            {
              instrument: "PETR4",
              quote_instrument: "BRL",
              date: "2026-10-16",
              value: "38.45",
              source: "manual",
            },
          ],
        });
      },
    });
    await renderApp("/instruments/PETR4", { fetch });
    expect(
      await screen.findByRole("heading", { name: "Petrobras PN" }),
    ).toBeInTheDocument();
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.prices.caption"],
    });
    await waitFor(() => {
      expect(rowTexts(table)).toContain("10/16/2026|38.45|Manual");
    });
    expect(rowTexts(table).slice(1)).toEqual([
      "10/16/2026|38.45|Manual",
      "10/14/2026|38.10|b3_cotahist",
    ]);
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      instrument: "PETR4",
      quote_instrument: "BRL",
      from: "2026-07-20",
      to: "2026-10-17",
    });
  });

  it("never asks for more than 366 days", async () => {
    const queries: URLSearchParams[] = [];
    const fetch = api({
      "GET /api/v1/prices": (req) => {
        queries.push(new URL(req.url).searchParams);
        return json(200, { items: [] });
      },
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("radio", {
        name: catalogEn["instrument.range.days"].replace("{count}", "366"),
      }),
    );
    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(1);
    });
    const last = queries.at(-1);
    const days =
      (Date.parse(last?.get("to") ?? "") -
        Date.parse(last?.get("from") ?? "")) /
        86_400_000 +
      1;
    expect(days).toBe(366);
  });

  it("records a manual price and says that one of the same date is replaced", async () => {
    const sent: unknown[] = [];
    const fetch = api({
      "POST /api/v1/prices": async (req) => {
        sent.push(await req.json());
        return json(201, {
          instrument: "PETR4",
          quote_instrument: "BRL",
          date: "2026-10-17",
          value: "38.50",
          source: "manual",
        });
      },
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instrument.price.record"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(catalogEn["instrument.price.replaceNote"]),
    ).toBeInTheDocument();
    const value = within(dialog).getByRole("textbox", { name: /^Price/ });
    await user.type(value, "abc");
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instrument.price.save"],
      }),
    );
    expect(
      await within(dialog).findByText(catalogEn["instrument.price.invalid"]),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
    await user.clear(value);
    await user.type(value, "38,50");
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instrument.price.save"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          instrument: "PETR4",
          quote_instrument: "BRL",
          date: "2026-10-17",
          value: "38.50",
        },
      ]);
    });
  });

  it("lists the positions that hold the instrument, linked to their accounts", async () => {
    await renderApp("/instruments/PETR4", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.positions.caption"],
    });
    await within(table).findByRole("link", { name: /PETR4/ });
    expect(rowTexts(table).slice(1)).toEqual([
      "Corretora / PETR4|100|35.00|R$3,500.00|R$3,845.00",
    ]);
    expect(within(table).getByRole("link", { name: /PETR4/ })).toHaveAttribute(
      "href",
      "/accounts/a1000000-0000-4000-8000-000000000005",
    );
  });

  it("shows the problem of an instrument that does not exist", async () => {
    await renderApp("/instruments/NOPE", { fetch: api() });
    expect(
      await screen.findByText(catalogEn["common.error.title"]),
    ).toBeInTheDocument();
  });
});
