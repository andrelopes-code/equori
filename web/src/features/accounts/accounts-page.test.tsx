import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import {
  accountRoutes,
  balancesAt,
  brokerageID,
  cardID,
  checkingID,
  connectionFixture,
  reserveID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { moneyValue } from "@/testing/money-value";
import { renderApp } from "@/testing/render-app";

function api(queries: URLSearchParams[] = [], overrides = {}) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/balances": (req) => {
        const query = new URL(req.url).searchParams;
        queries.push(query);
        return balancesAt(req);
      },
      [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () =>
        json(200, { last_reconciled_on: "2026-09-30" }),
      ...overrides,
    }),
  );
}

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

// A return route: the reserve paid 101.80% of the CDI (a rate profile) and the brokerage lost
// 13.80% while the CDI grew 3.52% (a market profile). asked collects the account of each request.
function comparedIn90Days(
  asked: string[],
  days = 63,
  extra: Record<string, unknown> = {},
) {
  return (req: Request) => {
    const query = new URL(req.url).searchParams;
    const account = query.get("account_id") ?? "";
    asked.push(account);
    const window = {
      index: "cdi",
      from: query.get("from"),
      until: query.get("to"),
      days,
      index_annual_bp: 1490,
    };
    const rate = {
      profile: "rate",
      period_bp: 340,
      benchmark: {
        ...window,
        return_bp: 340,
        index_bp: 334,
        percent_bp: 10180,
        annual_bp: 1517,
        excess_bp: 6,
        ...extra,
      },
    };
    const market = {
      profile: "market",
      period_bp: -1380,
      benchmark: {
        ...window,
        return_bp: -1380,
        index_bp: 352,
        excess_bp: -1732,
        ...extra,
      },
    };
    return json(200, {
      annual_bp: 0,
      flows: [],
      opening: { amount: 1000000, currency: "BRL" },
      closing: { amount: 1034000, currency: "BRL" },
      ...(account === brokerageID ? market : rate),
    });
  };
}

describe("AccountsPage", () => {
  it("adds up assets, liabilities and net worth in the base currency", async () => {
    await renderApp("/accounts", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["balanceSheet.figures"],
    });
    await waitFor(() => {
      expect(
        within(figures).getByText(moneyValue("R$15,390.55")),
      ).toBeInTheDocument();
    });
    expect(
      within(figures).getByText(moneyValue("R$14,500.00")),
    ).toBeInTheDocument();
    expect(
      within(figures).getByText(moneyValue("R$890.55")),
    ).toBeInTheDocument();
  });

  it("compares with the balances of 30 days earlier", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/accounts", { fetch: api(queries) });
    await waitFor(() => {
      expect(queries.map((q) => q.get("date")).sort()).toEqual([
        "2026-09-17",
        "2026-10-17",
      ]);
    });
  });

  it("leaves the trend empty, not loading, for an account that holds several instruments", async () => {
    let refused = 0;
    const { container } = await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/balances": () => {
          refused += 1;
          return problem(422, "mixed_instruments");
        },
      }),
    });
    await waitFor(() => {
      expect(refused).toBeGreaterThan(0);
      expect(container.querySelector('[data-ui="skeleton"]')).toBeNull();
    });
  });

  it("reads the settled balances when the basis says so", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/accounts?basis=settled", { fetch: api(queries) });
    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(0);
    });
    expect(queries.every((q) => q.get("basis") === "settled")).toBe(true);
  });

  it("nests sub-accounts under their parent and states the currencies left out", async () => {
    await renderApp("/accounts", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.available"],
    });
    await waitFor(() => {
      expect(
        within(table)
          .getAllByRole("rowheader")
          .map((cell) => cell.textContent)
          // The summary row's header closes the list.
          .filter((text) => text !== catalogEn["balanceSheet.groupTotal"]),
      ).toEqual([
        expect.stringContaining("Carteiras"),
        expect.stringContaining("Dinheiro"),
        expect.stringContaining("Nubank"),
        expect.stringContaining("Wise USD"),
      ]);
    });
    // Wise USD among the available accounts, PETR4 among the reserves.
    expect(
      screen.getAllByText(words("balanceSheet.excluded", { count: "1" })),
    ).toHaveLength(2);
  });

  it("states when an account was last reconciled", async () => {
    await renderApp("/accounts", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.available"],
    });
    const nubank = await within(table).findByRole("row", { name: /Nubank/ });
    expect(await within(nubank).findByText(/Reconciled/)).toBeInTheDocument();
  });

  it("adds a yield column to the group of a reserve and a brokerage (A208 R17)", async () => {
    const asked: string[] = [];
    await renderApp("/accounts", {
      fetch: api([], { "GET /api/v1/reports/return": comparedIn90Days(asked) }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    expect(
      within(reserves).getByRole("columnheader", {
        name: catalogEn["balanceSheet.yield"],
      }),
    ).toBeInTheDocument();
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });
    expect(
      await within(reserve).findByText("15.17% a year"),
    ).toBeInTheDocument();
    expect(within(reserve).getByText("101.80% of CDI")).toBeInTheDocument();
    const broker = within(reserves).getByRole("row", { name: /Corretora/ });
    // A loss reads in the danger tone; a gain in the default one.
    expect(await within(broker).findByText("−13.80%")).toHaveAttribute(
      "data-tone",
      "danger",
    );
    expect(within(reserve).getByText("15.17% a year")).toHaveAttribute(
      "data-tone",
      "default",
    );
    expect(within(broker).getByText("CDI 3.52%")).toBeInTheDocument();
    expect(within(broker).queryByText(/a year|of CDI/)).not.toBeInTheDocument();
    expect(reserves).not.toHaveTextContent(/\d d\b|since/);
    expect(catalogEn["balanceSheet.yield"]).toBe("Yield");
    expect(catalogPtBR["balanceSheet.yield"]).toBe("Rendimento");
    const available = screen.getByRole("table", {
      name: catalogEn["home.group.available"],
    });
    expect(
      within(available).queryByRole("columnheader", {
        name: catalogEn["balanceSheet.yield"],
      }),
    ).not.toBeInTheDocument();
    expect(asked.sort()).toEqual([reserveID, brokerageID].sort());
  });

  it("reads the rate a year and the percent of the index from 13 days, with no start day (R21)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": comparedIn90Days([], 13),
      }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });

    expect(
      await within(reserve).findByText("15.17% a year"),
    ).toBeInTheDocument();
    expect(within(reserve).getByText("101.80% of CDI")).toBeInTheDocument();
    expect(reserve).not.toHaveTextContent(/since|\d d\b/);
  });

  it("states the day a late start begins from after the percent of the index (R21)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": comparedIn90Days([], 14, {
          from: "2026-10-19",
          started_late: true,
        }),
      }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });
    const broker = within(reserves).getByRole("row", { name: /Corretora/ });

    expect(
      await within(reserve).findByText("101.80% of CDI · since 10/19"),
    ).toBeInTheDocument();
    expect(reserve).toHaveTextContent(
      /15\.17% a year\s*101\.80% of CDI · since 10\/19/,
    );
    expect(await within(broker).findByText("−13.80%")).toBeInTheDocument();
    expect(
      within(broker).getByText("CDI 3.52% · since 10/19"),
    ).toBeInTheDocument();
    expect(reserves).not.toHaveTextContent(/\d d\b/);
  });

  it("writes the late start in Portuguese with the day first (R21)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/me": () =>
          json(200, {
            id: 1,
            email: "a@b.c",
            books_id: 1,
            role: "admin",
            language: "pt",
            region: "BR",
          }),
        "GET /api/v1/reports/return": comparedIn90Days([], 14, {
          from: "2026-10-19",
          started_late: true,
        }),
      }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogPtBR["home.group.reserves"],
    });
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });

    expect(
      await within(reserve).findByText("101,80% do índice CDI · desde 19/10"),
    ).toBeInTheDocument();
    expect(reserve).toHaveTextContent(
      /15,17% a\.a\.\s*101,80% do índice CDI · desde 19\/10/,
    );
  });

  it("appends the error of the percent to the cell (R22)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": comparedIn90Days([], 63, {
          percent_error_bp: 250,
        }),
      }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });

    expect(
      await within(reserve).findByText("101.80% ±2.55 pp of CDI"),
    ).toBeInTheDocument();
  });

  it.each([
    ["no_yield_recorded", "No yield recorded in the period"],
    ["single_credit", "Only one yield credit recorded"],
    ["nothing_held", "Nothing held in the period"],
  ])(
    "states the reason alone, never a 0.00% return: %s (R8, R23, W2)",
    async (reason, text) => {
      await renderApp("/accounts", {
        fetch: api([], {
          "GET /api/v1/reports/return": () =>
            json(200, {
              annual_bp: 0,
              flows: [],
              opening: { amount: 1000000, currency: "BRL" },
              closing: { amount: 1000000, currency: "BRL" },
              profile: "rate",
              period_bp: 0,
              index: "cdi",
              unavailable_reason: reason,
            }),
        }),
      });
      const reserves = await screen.findByRole("table", {
        name: catalogEn["home.group.reserves"],
      });
      const reserve = await within(reserves).findByRole("row", {
        name: /Reserva de emergência/,
      });

      expect(await within(reserve).findByText(text)).toBeInTheDocument();
      expect(within(reserve).queryByText(/0\.00%/)).not.toBeInTheDocument();
    },
  );

  it.each([
    ["no_index_for_region", "No reference index for the region"],
    ["currency_mismatch", "Values in BRL: CDI applies to another currency"],
    ["no_rate_in_window", "CDI has no rate yet for the days compared"],
    ["percent_undefined", "The percent of CDI is not defined for this return"],
  ])(
    "reads the period return since the window start beside the reason: %s (R8, W2)",
    async (reason, text) => {
      await renderApp("/accounts", {
        fetch: api([], {
          "GET /api/v1/reports/return": () =>
            json(200, {
              annual_bp: 0,
              flows: [],
              opening: { amount: 1000000, currency: "BRL" },
              closing: { amount: 1034000, currency: "BRL" },
              profile: "rate",
              period_bp: 340,
              index: "cdi",
              unavailable_reason: reason,
            }),
        }),
      });
      const reserves = await screen.findByRole("table", {
        name: catalogEn["home.group.reserves"],
      });
      const reserve = await within(reserves).findByRole("row", {
        name: /Reserva de emergência/,
      });

      expect(await within(reserve).findByText("3.40%")).toBeInTheDocument();
      expect(
        within(reserve).getByText(`${text} · since 07/20`),
      ).toBeInTheDocument();
    },
  );

  it("draws the yield cell as two lines that never end on the separator (R8, R21)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": comparedIn90Days([], 63, {
          started_late: true,
        }),
      }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });

    const first = await within(reserve).findByText("15.17% a year");
    const lines = Array.from(first.parentElement?.children ?? []);

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.textContent)).toEqual([
      "15.17% a year",
      expect.stringMatching(/^101\.80% of CDI · since \d\d\/\d\d$/u),
    ]);
    expect(lines.map((line) => line.getAttribute("data-wrap"))).toEqual([
      "nowrap",
      "nowrap",
    ]);
  });

  it.each([
    [
      "en",
      "Fewer than 5 days with a CDI rate: one credit would distort the percent",
    ],
    ["pt", "Menos de 5 dias com taxa CDI: um crédito distorceria o percentual"],
  ])(
    "states the return and why the percent is absent below five days: %s (R22, R23)",
    async (language, text) => {
      await renderApp("/accounts", {
        fetch: api([], {
          "GET /api/v1/me": () =>
            json(200, {
              id: 1,
              email: "a@b.c",
              books_id: 1,
              role: "admin",
              language,
              region: "BR",
            }),
          "GET /api/v1/reports/return": () =>
            json(200, {
              flows: [],
              opening: { amount: 1000000, currency: "BRL" },
              closing: { amount: 1034000, currency: "BRL" },
              profile: "rate",
              period_bp: 340,
              index: "cdi",
              unavailable_reason: "too_few_days",
              benchmark: {
                index: "cdi",
                from: "2026-07-20",
                until: "2026-07-20",
                days: 1,
                return_bp: 6,
                index_bp: 6,
                index_annual_bp: 1490,
              },
            }),
        }),
      });
      const reserves = await screen.findByRole("table", {
        name: (language === "en" ? catalogEn : catalogPtBR)[
          "home.group.reserves"
        ],
      });
      const reserve = await within(reserves).findByRole("row", {
        name: /Reserva de emergência/,
      });

      expect(await within(reserve).findByText(text)).toBeInTheDocument();
      expect(
        within(reserve).getByText(language === "en" ? "0.06%" : "0,06%"),
      ).toBeInTheDocument();
    },
  );

  it("keeps the figure on one line and lets a long reason wrap in the cell (R8)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": () =>
          json(200, {
            annual_bp: 0,
            flows: [],
            opening: { amount: 1000000, currency: "BRL" },
            closing: { amount: 1034000, currency: "BRL" },
            profile: "rate",
            period_bp: 340,
            index: "cdi",
            unavailable_reason: "no_rate_in_window",
          }),
      }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });

    const figure = await within(reserve).findByText("3.40%");
    const reason = within(reserve).getByText(
      "CDI has no rate yet for the days compared · since 07/20",
    );

    expect(reason.textContent).toBe(
      "CDI has no rate yet for the days compared\u00A0·\u00A0since 07/20",
    );
    expect(figure).toHaveAttribute("data-wrap", "nowrap");
    expect(reason).not.toHaveAttribute("data-wrap", "nowrap");
    expect(figure.parentElement).not.toHaveAttribute("data-wrap", "nowrap");
  });

  it("states only the rate on a phone, with no days (A208 R17)", async () => {
    await renderApp("/accounts", {
      fetch: api([], { "GET /api/v1/reports/return": comparedIn90Days([]) }),
      width: 390,
    });
    const list = await screen.findByRole("list", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(list).findByRole("link", {
      name: /Reserva de emergência/,
    });
    expect(
      await within(reserve).findByText("15.17% a year"),
    ).toBeInTheDocument();
    expect(within(reserve).queryByText(/of CDI/)).not.toBeInTheDocument();
    expect(reserve).not.toHaveTextContent(/\d d\b|since/);
  });

  it("keeps the figure and the late start day on one line on a phone (R21)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": comparedIn90Days([], 14, {
          from: "2026-10-19",
          started_late: true,
        }),
      }),
      width: 390,
    });
    const list = await screen.findByRole("list", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(list).findByRole("link", {
      name: /Reserva de emergência/,
    });

    const figure = await within(reserve).findByText("15.17% a year");
    const since = within(reserve).getByText("· since 10/19");

    expect(figure).toHaveAttribute("data-wrap", "nowrap");
    expect(since).toHaveAttribute("data-wrap", "nowrap");
    expect(figure.parentElement).toHaveAttribute("data-wrap", "nowrap");
    expect(figure.parentElement).toContainElement(since);
    expect(reserve).not.toHaveTextContent(/of CDI|\d d\b/);
  });

  it("truncates a reason alone to one line on a phone (R21, R23)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": () =>
          json(200, {
            flows: [],
            opening: { amount: 1000000, currency: "BRL" },
            closing: { amount: 1034000, currency: "BRL" },
            profile: "rate",
            period_bp: 0,
            index: "cdi",
            unavailable_reason: "no_yield_recorded",
          }),
      }),
      width: 390,
    });
    const list = await screen.findByRole("list", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(list).findByRole("link", {
      name: /Reserva de emergência/,
    });

    const reason = await within(reserve).findByText(
      "No yield recorded in the period",
    );

    expect(reason).toHaveAttribute("data-truncate", "1");
    expect(reason.textContent).toBe("No yield recorded in the period");
    expect(reserve).not.toHaveTextContent(/since|\d d\b/);
  });

  it("opens a card on the cards destination", async () => {
    const { router } = await renderApp("/accounts", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.cards"],
    });
    await userEvent.click(
      await within(table).findByRole("link", { name: /Itaú Visa/ }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/cards/${cardID}`);
    });
  });

  it("shows closed accounts only when asked", async () => {
    await renderApp("/accounts", { fetch: api() });
    await screen.findByRole("table", {
      name: catalogEn["home.group.available"],
    });
    expect(screen.queryByText("Conta antiga")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("switch", {
        name: catalogEn["balanceSheet.showClosed"],
      }),
    );
    // The sheet renders again from the deferred search, after the switch has painted (CP-09).
    expect(
      await screen.findByText("Conta antiga", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it("says how many external accounts wait for a link", async () => {
    await renderApp("/accounts", { fetch: api() });
    const pending = connectionFixture.accounts.filter(
      (a) => a.state === "pending",
    ).length;
    expect(
      await screen.findByText(
        words("balanceSheet.pendingLinks", { count: String(pending) }),
      ),
    ).toBeInTheDocument();
  });

  it("offers the first account when there is none", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/accounts": () => json(200, { items: [] }),
        "GET /api/v1/balances": () => json(200, { items: [] }),
        "GET /api/v1/connections": () => json(200, { items: [] }),
      }),
    });
    expect(
      await screen.findByText(catalogEn["balanceSheet.empty"]),
    ).toBeInTheDocument();
  });

  it("lists rows instead of tables on a phone", async () => {
    await renderApp("/accounts", { fetch: api(), width: 390 });
    expect(
      await screen.findByRole("list", {
        name: catalogEn["home.group.available"],
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("AccountsPage on a phone (ADR 027, S6)", () => {
  it("offers no new account and no strip of desktop-only tabs", async () => {
    await renderApp("/accounts", { fetch: api(), width: 390 });
    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.queryByRole("button", { name: catalogEn["balanceSheet.new"] }),
    ).toBeNull();
    expect(
      screen.queryByRole("tablist", { name: catalogEn["nav.accounts"] }),
    ).toBeNull();
  });
});
