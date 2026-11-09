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
    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: catalogEn["instrument.prices.caption"],
      }),
    );
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.prices.caption"],
    });
    await waitFor(() => {
      expect(rowTexts(table)).toContain("10/16/2026|38.45|Manual");
    });
    expect(rowTexts(table).slice(1)).toEqual([
      "10/16/2026|38.45|Manual",
      "10/14/2026|38.10|B3, daily quotes",
    ]);
    expect(
      screen.getByRole("group", { name: catalogEn["instrument.prices.title"] }),
    ).toBeVisible();
    expect(
      document.querySelector('[data-ui="chart"] [data-part="title"]'),
    ).toBeNull();
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      instrument: "PETR4",
      quote_instrument: "BRL",
      from: "2026-07-20",
      to: "2026-10-17",
    });
  });

  it("states an empty range once, without a chart beside the table", async () => {
    const fetch = api({
      "GET /api/v1/prices": () => json(200, { items: [] }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    expect(
      await screen.findByText(catalogEn["instrument.prices.empty"]),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-ui="chart"]')).toBeNull();
  });

  it("shows the facts of the instrument", async () => {
    await renderApp("/instruments/PETR4", { fetch: api({}) });
    const scale = await screen.findByText(catalogEn["instruments.field.scale"]);

    expect(scale.nextElementSibling?.textContent).toBe("0");
    expect(
      screen.queryByText(catalogEn["instruments.col.subtype"]),
    ).not.toBeInTheDocument();
  });

  // MQ31
  it("asks five years and then from the first quote", async () => {
    const queries: URLSearchParams[] = [];
    const fetch = api({
      "GET /api/v1/instruments/PETR4": () =>
        json(200, {
          code: "PETR4",
          type: "stock",
          scale: 0,
          name: "Petrobras PN",
          quote_currency: "BRL",
          exchange: "B3SA",
          coverage: {
            first: "2010-01-04",
            last: "2026-10-16",
            count: 2,
            stale: false,
            sources: [],
          },
        }),
      "GET /api/v1/prices": (req) => {
        queries.push(new URL(req.url).searchParams);
        return json(200, { items: [] });
      },
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();
    const before = queries.length;
    await user.click(
      await screen.findByRole("radio", {
        name: catalogEn["instrument.range.y5"],
      }),
    );
    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(before);
    });
    const last = queries.at(-1);
    const days =
      (Date.parse(last?.get("to") ?? "") -
        Date.parse(last?.get("from") ?? "")) /
        86_400_000 +
      1;
    expect(days).toBe(1827);
    await user.click(
      await screen.findByRole("radio", {
        name: catalogEn["instrument.range.max"],
      }),
    );
    await waitFor(() => {
      expect(queries.at(-1)?.get("from")).toBe("2010-01-04");
    });
  });

  describe("coverage line", () => {
    const withCoverage = (coverage: unknown, sent: unknown[] = []) =>
      api({
        "GET /api/v1/instruments/PETR4": () =>
          json(200, {
            code: "PETR4",
            type: "stock",
            scale: 0,
            name: "Petrobras PN",
            quote_currency: "BRL",
            exchange: "B3SA",
            coverage,
          }),
        "POST /api/v1/instruments/PETR4/history": async (req) => {
          sent.push(await req.json());
          return new Response(null, { status: 202 });
        },
      });
    const source = (over: object) => ({
      id: "b3_cotahist",
      enabled: true,
      official: true,
      first: null,
      last: null,
      history: null,
      ...over,
    });
    const base = {
      first: "2026-10-14",
      last: "2026-10-16",
      count: 2,
      stale: false,
    };
    const failed = {
      from: "2006-10-17",
      done: false,
      error: "fetch PTAX USD: status 500",
    };

    it("MQ35: states the dates, the count and the source of the quotes", async () => {
      const fetch = withCoverage({
        ...base,
        sources: [source({ first: "2026-10-14", last: "2026-10-16" })],
      });
      await renderApp("/instruments/PETR4", { fetch });

      expect(
        await screen.findByText(
          "Quotes from 10/14/2026 to 10/16/2026 · 2 quotes · B3, daily quotes",
        ),
      ).toBeInTheDocument();
    });

    it("MQ35: loads the history since a date from the dialog", async () => {
      const sent: unknown[] = [];
      const fetch = withCoverage(
        {
          first: null,
          last: null,
          count: 0,
          stale: false,
          sources: [source({})],
        },
        sent,
      );
      await renderApp("/instruments/PETR4", { fetch });
      const user = userEvent.setup();

      expect(await screen.findByText("No quote")).toBeInTheDocument();
      await user.click(
        screen.getByRole("button", {
          name: catalogEn["instruments.history.load"],
        }),
      );
      const dialog = await screen.findByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", {
          name: catalogEn["instruments.history.send"],
        }),
      );

      await waitFor(() => {
        expect(sent).toEqual([{ from: "2006-10-17" }]);
      });
    });

    it("MQ35: states a history that is loading", async () => {
      const fetch = withCoverage({
        ...base,
        sources: [source({ history: { ...failed, error: null } })],
      });
      await renderApp("/instruments/PETR4", { fetch });

      expect(
        await screen.findByText("Loading history since 10/17/2006"),
      ).toBeInTheDocument();
    });

    it("MQ35: states a failed history and tries again from the same date", async () => {
      const sent: unknown[] = [];
      const fetch = withCoverage(
        { ...base, sources: [source({ history: failed })] },
        sent,
      );
      await renderApp("/instruments/PETR4", { fetch });

      expect(
        await screen.findByText(
          "History since 10/17/2006 failed: fetch PTAX USD: status 500",
        ),
      ).toBeInTheDocument();
      await userEvent.setup().click(
        screen.getByRole("button", {
          name: catalogEn["instruments.history.retry"],
        }),
      );

      await waitFor(() => {
        expect(sent).toEqual([{ from: "2006-10-17" }]);
      });
    });

    it("MQ35: warns that the last quote is late", async () => {
      const fetch = withCoverage({
        ...base,
        last: "2026-10-12",
        stale: true,
        sources: [source({ last: "2026-10-12" })],
      });
      await renderApp("/instruments/PETR4", { fetch });

      expect(
        await screen.findByText("The last quote, of 10/12/2026, is late."),
      ).toBeInTheDocument();
    });

    it("MQ35: states the age of the last quote when no source is enabled", async () => {
      const fetch = withCoverage({
        ...base,
        last: "2026-10-12",
        sources: [source({ enabled: false, last: "2026-10-12" })],
      });
      await renderApp("/instruments/PETR4", { fetch });

      expect(
        await screen.findByText("Last quote 5 days ago"),
      ).toBeInTheDocument();
    });
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

  it("edits the name, exchange and subtype of a security and sends a cleared exchange as absent", async () => {
    const sent: unknown[] = [];
    const fetch = api({
      "PATCH /api/v1/instruments/PETR4": async (req) => {
        sent.push(await req.json());
        return json(200, {
          code: "PETR4",
          type: "stock",
          scale: 0,
          name: "Petrobras PN Nova",
          quote_currency: "BRL",
        });
      },
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: catalogEn["instrument.edit"] }),
    );
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: /^Name/ });
    const exchange = within(dialog).getByRole("textbox", {
      name: /^Exchange/,
    });
    expect(name).toHaveValue("Petrobras PN");
    expect(exchange).toHaveValue("B3SA");
    await user.clear(name);
    await user.type(name, "Petrobras PN Nova");
    await user.clear(exchange);
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instrument.edit.save"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ name: "Petrobras PN Nova" }]);
    });
  });

  it("offers no edit on a currency", async () => {
    await renderApp("/instruments/USD", { fetch: api() });
    expect(
      await screen.findByRole("heading", { name: "Dollar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: catalogEn["instrument.edit"] }),
    ).toBeNull();
  });

  it("lists the positions that hold the instrument, linked to their accounts", async () => {
    await renderApp("/instruments/PETR4", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.positions.caption"],
    });
    await within(table).findByRole("link", { name: /PETR4/ });
    expect(rowTexts(table).slice(1)).toEqual([
      "Corretora / PETR4|100|R$35.00|R$3,500.00|R$3,845.00",
    ]);
    expect(within(table).getByRole("link", { name: /PETR4/ })).toHaveAttribute(
      "href",
      "/accounts/a1000000-0000-4000-8000-000000000005",
    );
  });

  it("PC19: states the position before the prices and nothing for an instrument not held", async () => {
    const { unmount } = await renderApp("/instruments/PETR4", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.positions.caption"],
    });
    const prices = screen.getByRole("group", {
      name: catalogEn["instrument.prices.title"],
    });

    expect(
      table.compareDocumentPosition(prices) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    unmount();

    await renderApp("/instruments/PETR4", {
      fetch: api({
        "GET /api/v1/positions": () => json(200, { items: [] }),
      }),
    });
    await screen.findByRole("group", {
      name: catalogEn["instrument.prices.title"],
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: catalogEn["instrument.positions.title"],
        }),
      ).toBeNull();
    });
  });

  it("shows the problem of an instrument that does not exist", async () => {
    await renderApp("/instruments/NOPE", { fetch: api() });
    expect(
      await screen.findByText(catalogEn["common.error.title"]),
    ).toBeInTheDocument();
  });
});
