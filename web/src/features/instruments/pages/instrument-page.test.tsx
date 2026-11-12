import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
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

const twoPrices = [
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
];

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
        name: catalogEn["instrument.prices.open"],
      }),
    );
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.prices.caption"],
    });
    await waitFor(() => {
      expect(rowTexts(table)).toContain("10/16/2026|38.45|+0.92%|Manual");
    });
    expect(rowTexts(table).slice(1)).toEqual([
      "10/16/2026|38.45|+0.92%|Manual",
      "10/14/2026|38.10|—|B3, daily quotes",
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

  // L1, DL1, DL2
  it("L1: the page holds the summary line and no price table until the button is pressed", async () => {
    const fetch = api({
      "GET /api/v1/prices": () => json(200, { items: twoPrices }),
    });
    await renderApp("/instruments/PETR4", { fetch });

    expect(
      await screen.findByText(
        "Prices: 2, from 10/14/2026 to 10/16/2026. Latest source: Manual.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", {
        name: catalogEn["instrument.prices.caption"],
      }),
    ).toBeNull();
  });

  it("L1: the layer opens with the figure strip", async () => {
    const fetch = api({
      "GET /api/v1/prices": () => json(200, { items: twoPrices }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: catalogEn["instrument.prices.open"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const card = (label: string) =>
      within(dialog).getByText(label).closest("[data-ui='stat-card']");

    expect(card(catalogEn["instrument.prices.points"])).toHaveTextContent(
      "Prices2",
    );
    expect(card(catalogEn["instrument.prices.first"])).toHaveTextContent(
      "First date10/14/2026R$38.10",
    );
    expect(card(catalogEn["instrument.prices.last"])).toHaveTextContent(
      "Last date10/16/2026R$38.45",
    );
    expect(card(catalogEn["instrument.prices.high"])).toHaveTextContent(
      "HighestR$38.4510/16/2026",
    );
    expect(card(catalogEn["instrument.prices.low"])).toHaveTextContent(
      "LowestR$38.1010/14/2026",
    );
  });

  it("L1: the filter keeps the change of the full series", async () => {
    const fetch = api({
      "GET /api/v1/prices": () => json(200, { items: twoPrices }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instrument.prices.open"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["instrument.prices.filter"],
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Manual" }));

    await waitFor(() => {
      expect(
        rowTexts(
          within(dialog).getByRole("table", {
            name: catalogEn["instrument.prices.caption"],
          }),
        ).slice(1),
      ).toEqual(["10/16/2026|38.45|+0.92%|Manual"]);
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

    // A223 RM10
    it("keeps the retry in the failure alert and the other actions in one toolbar", async () => {
      const fetch = withCoverage({
        ...base,
        sources: [source({ history: failed })],
      });
      await renderApp("/instruments/PETR4", { fetch });

      const alert = (
        await screen.findByText(/^History since 10\/17\/2006 failed/)
      ).closest<HTMLElement>('[data-ui="alert"]');
      if (alert === null) throw new Error("the failure is not in an alert");
      expect(
        within(alert).getByRole("button", {
          name: catalogEn["instruments.history.retry"],
        }),
      ).toBeVisible();

      const toolbar = screen.getByRole("toolbar", {
        name: catalogEn["instruments.actions"],
      });
      expect(
        within(toolbar)
          .getAllByRole("button")
          .map((button) => button.textContent),
      ).toEqual([
        catalogEn["instruments.history.load"],
        catalogEn["prices.import.one"],
      ]);
    });

    // The warning is a tag on the quote, not an alert that moves the page.
    it("MQ35: marks the last quote as late", async () => {
      const fetch = withCoverage({
        ...base,
        last: "2026-10-12",
        stale: true,
        sources: [source({ last: "2026-10-12" })],
      });
      await renderApp("/instruments/PETR4", { fetch });

      expect(
        await screen.findByText(catalogEn["instrument.quote.stale"]),
      ).toBeInTheDocument();
      expect(document.querySelector('[data-ui="alert"]')).toBeNull();
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

  it("imports a pasted series after a dry run", async () => {
    const sent: unknown[] = [];
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
      "POST /api/v1/instruments/PETR4/prices": async (req) => {
        sent.push(await req.json());
        return json(200, {
          new: 2,
          replaced: 0,
          unchanged: 0,
          below_feed: 1,
        });
      },
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["prices.import.one"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["prices.import.paste.label"],
      }),
      "Data;Valor\n02/01/2024;5,12\n03/01/2024;5,15\nTotal;10,27",
    );
    for (const text of [
      "Columns found: Data, Valor",
      "2 quotes read",
      "1 line skipped",
      "Line 4: Total | 10,27",
      "2 new · 0 replaced · 0 unchanged",
      "On 1 date the imported value takes the place of the quote of an official source.",
    ]) {
      expect(await within(dialog).findByText(text)).toBeInTheDocument();
    }
    const prices = [
      { date: "2024-01-02", value: "5.12" },
      { date: "2024-01-03", value: "5.15" },
    ];
    expect(sent[0]).toEqual({
      quote_instrument: "BRL",
      prices,
      dry_run: true,
    });

    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["prices.import.preview.record"],
      }),
    );

    expect(await within(dialog).findByText("2 prices recorded.")).toBeVisible();
    expect(sent[1]).toEqual({ quote_instrument: "BRL", prices });
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

  it("sets the symbol a source requests", async () => {
    const sent: unknown[] = [];
    const fetch = api({
      "GET /api/v1/market-data/feeds": () =>
        json(200, {
          items: [
            {
              id: "yahoo_chart",
              kind: "price",
              enabled: false,
              suggested: false,
              last: null,
              stale: false,
              last_run: null,
              error: null,
              official: false,
              covers: 0,
              history_pending: 0,
              symbol_override: true,
            },
            {
              id: "b3_cotahist",
              kind: "price",
              enabled: true,
              suggested: false,
              last: null,
              stale: false,
              last_run: null,
              error: null,
              official: true,
              covers: 1,
              history_pending: 0,
              symbol_override: false,
            },
          ],
        }),
      "PATCH /api/v1/instruments/PETR4": async (req) => {
        sent.push(await req.json());
        return json(200, {
          code: "PETR4",
          type: "stock",
          scale: 0,
          name: "Petrobras PN",
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
    await user.type(
      await within(dialog).findByRole("textbox", {
        name: /^Symbol at Yahoo Finance/,
      }),
      "PETR4.SA",
    );
    expect(
      within(dialog).getAllByRole("textbox", { name: /^Symbol at/ }),
    ).toHaveLength(1);
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instrument.edit.save"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          name: "Petrobras PN",
          exchange: "B3SA",
          symbols: { yahoo_chart: "PETR4.SA" },
        },
      ]);
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
      "Corretora / PETR4|100|R$35.00|R$3,500.00|R$3,845.00|+R$345.00 (+9.86%)",
    ]);
    expect(within(table).getByRole("link", { name: /PETR4/ })).toHaveAttribute(
      "href",
      "/accounts/a1000000-0000-4000-8000-000000000005",
    );
  });

  it("PC19: states the position after the quote and nothing for an instrument not held", async () => {
    const { unmount } = await renderApp("/instruments/PETR4", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.positions.caption"],
    });
    const prices = screen.getByRole("group", {
      name: catalogEn["instrument.prices.title"],
    });

    expect(
      prices.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
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

// A223: the waiting state of the page stands for its anatomy.
describe("Instrument page while it loads", () => {
  it("reserves the heading, the sections and the chart", async () => {
    const fetch = api({
      "GET /api/v1/instruments/PETR4": () =>
        new Promise<Response>(() => undefined),
    });
    await renderApp("/instruments/PETR4", { fetch });

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-ui="skeleton"]').length,
      ).toBeGreaterThanOrEqual(5);
    });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});

// A223 RM5
describe("Remove instrument", () => {
  it("confirms, deletes the security and returns to the list", async () => {
    const fetch = api({
      "DELETE /api/v1/instruments/PETR4": () =>
        new Response(null, { status: 204 }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instrument.remove"],
      }),
    );
    expect(
      await screen.findByText(catalogEn["instrument.remove.body"]),
    ).toBeVisible();
    expect(fetch.calls).not.toContain("DELETE /api/v1/instruments/PETR4");

    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: catalogEn["instrument.remove.confirm"],
      }),
    );

    expect(
      await screen.findByText(catalogEn["instruments.subtitle"]),
    ).toBeVisible();
  });

  it("states that a record still uses the security and keeps the dialog open", async () => {
    const fetch = api({
      "DELETE /api/v1/instruments/PETR4": () =>
        problem(409, "instrument_in_use"),
    });
    await renderApp("/instruments/PETR4", { fetch });
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["instrument.remove"],
      }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: catalogEn["instrument.remove.confirm"],
      }),
    );

    expect(
      await screen.findByText(catalogEn["problem.instrument_in_use"]),
    ).toBeVisible();
    expect(screen.getByRole("alertdialog")).toBeVisible();
  });

  it("offers no removal for a currency", async () => {
    await renderApp("/instruments/USD", { fetch: api() });
    await screen.findByRole("heading", { name: "Dollar" });

    expect(
      screen.queryByRole("button", { name: catalogEn["instrument.remove"] }),
    ).toBeNull();
  });
});
