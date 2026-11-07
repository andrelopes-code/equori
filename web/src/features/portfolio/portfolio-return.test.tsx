import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { accounts, brokerID } from "@/testing/investment-api";
import {
  comparedReturn,
  marketReturn,
  contributionReturn,
  plainReturn,
  portfolioApi,
} from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const flows = () =>
  screen.findByRole("table", { name: catalogEn["portfolio.return.flows"] });

const performance = () =>
  screen.findByRole("region", { name: catalogEn["holdings.return"] });

const openMethod = async () => {
  await userEvent
    .setup()
    .click(
      await screen.findByRole("button", { name: catalogEn["holdings.method"] }),
    );
};

describe("Portfolio return", () => {
  it("PC11: leads with the return of the period when no index compares it (S126)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () =>
        json(200, { ...plainReturn, period_bp: 480 }),
    });
    await renderApp("/portfolio", { fetch });
    const section = await performance();

    expect(await within(section).findByText("4.80%")).toBeInTheDocument();
    expect(
      within(section).getByText(catalogEn["holdings.return.period"]),
    ).toBeInTheDocument();
  });

  it("PC11: falls back to the personal rate of a report without a period return", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const section = await performance();

    expect(await within(section).findByText("5.00%")).toBeInTheDocument();
    expect(
      within(section).getByText(catalogEn["holdings.return.personal"]),
    ).toBeInTheDocument();
  });

  it("PC12: keeps the method closed and states its figures on request (S126)", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    await performance();

    expect(await screen.findByText(catalogEn["holdings.method"])).toBeVisible();
    expect(screen.queryByText(/R\$1,050\.00/)).toBeNull();

    await openMethod();

    expect(await screen.findByText(/R\$1,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$1,050\.00/)).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["portfolio.return.noFlows"]),
    ).toBeInTheDocument();
  });

  it("PC12: names both rates and says how they differ", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, marketReturn),
    });
    await renderApp("/portfolio", { fetch });
    await performance();
    await openMethod();

    expect(
      await screen.findByText(catalogEn["holdings.method.personal"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["holdings.method.period"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["holdings.method.difference"]),
    ).toBeInTheDocument();
  });

  it("PC11: compares a rate with the CDI by the figures of the account page (S302)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, comparedReturn),
    });
    await renderApp("/portfolio", { fetch });
    const group = await screen.findByRole("group", {
      name: catalogEn["portfolio.yield.group.index"].replace("{index}", "CDI"),
    });

    expect(
      within(group).getByText(
        catalogEn["portfolio.yield.row.percent"].replace("{index}", "CDI"),
      ),
    ).toBeInTheDocument();
    expect(within(group).getByText("100.00%")).toBeInTheDocument();
  });

  it("PC11: states what the profile means under the groups, not under the heading (A208 R17)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, marketReturn),
    });
    await renderApp("/portfolio", { fetch });
    const section = await performance();
    const group = await within(section).findByRole("group", {
      name: catalogEn["portfolio.yield.group.index"].replace("{index}", "CDI"),
    });

    const profile = within(section).getByText(
      catalogEn["portfolio.yield.profile.market"].replaceAll("{index}", "CDI"),
    );

    expect(
      group.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("PC11: states what a market profile means, its difference from the CDI and its real return (S306, S308)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, marketReturn),
    });
    await renderApp("/portfolio", { fetch });
    const section = await performance();

    expect(
      await within(section).findByText(
        catalogEn["portfolio.yield.profile.market"].replaceAll(
          "{index}",
          "CDI",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(section).getByText("−10.33 pp")).toBeInTheDocument();
    expect(within(section).getByText("−0.89%")).toBeInTheDocument();
    expect(
      within(section).queryByText(
        catalogEn["portfolio.yield.row.percent"].replace("{index}", "CDI"),
      ),
    ).not.toBeInTheDocument();
  });

  it("PC13: lists the deposits and withdrawals of a contribution (S126)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, contributionReturn),
    });
    await renderApp("/portfolio", { fetch });
    await performance();
    await openMethod();

    expect(await screen.findByText(/R\$2,050\.00/)).toBeInTheDocument();
    const table = await flows();
    expect(
      within(table)
        .getAllByRole("row")
        .map((row) =>
          [...row.querySelectorAll("th, td")]
            .map((c) => c.textContent)
            .join("|"),
        ),
    ).toEqual(["Date|Amount", "04/30/2026|R$1,000.00"]);
  });

  it("PC10: chooses the period with one control and writes it to the address", async () => {
    const asked: string[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": (req) => {
        const q = new URL(req.url).searchParams;
        asked.push(`${q.get("from") ?? ""} ${q.get("to") ?? ""}`);
        return json(200, plainReturn);
      },
    });
    const { router } = await renderApp("/portfolio", {
      fetch,
      today: "2026-10-24",
    });
    const user = userEvent.setup();
    const section = await performance();

    await user.click(
      await within(section).findByRole("button", {
        name: /25\/10\/2025|10\/25\/2025|Oct 25|25 Oct/,
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["transactions.period.last90Days"],
      }),
    );

    await waitFor(() => {
      expect(asked.at(-1)).toBe("2026-07-27 2026-10-24");
    });
    expect(router.state.location.search).toMatchObject({
      from: "2026-07-27",
      to: "2026-10-24",
    });
  });

  it("PC10: offers the 12 months back and clears them from the address", async () => {
    const { router } = await renderApp(
      "/portfolio?from=2026-07-27&to=2026-10-24",
      { fetch: portfolioApi(), today: "2026-10-24" },
    );
    const user = userEvent.setup();
    const section = await performance();

    await user.click(
      await within(section).findByRole("button", { name: /Jul|07\/27|27\/07/ }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["holdings.period.year"],
      }),
    );

    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty("from");
    });
    expect(router.state.location.search).not.toHaveProperty("to");
  });

  it("PC10: reads a period that ends after today up to today", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": (req) => {
        asked.push(new URL(req.url).searchParams.get("to"));
        return json(200, plainReturn);
      },
    });
    await renderApp("/portfolio?from=2026-01-01&to=2026-12-31", {
      fetch,
      today: "2026-10-24",
    });

    await waitFor(() => {
      expect(asked).toEqual(["2026-10-24"]);
    });
  });

  it("asks for the whole portfolio over the 12 months ending at the valuation date, in EUR", async () => {
    const asked: URLSearchParams[] = [];
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const fetch = portfolioApi({
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/reports/return": (req) => {
        asked.push(new URL(req.url).searchParams);
        return json(200, contributionReturn);
      },
    });
    await renderApp("/portfolio?date=2026-10-31", { fetch });
    await waitFor(() => {
      expect(
        asked.map((q) => [
          q.get("account_id"),
          q.get("from"),
          q.get("to"),
          q.get("value_in"),
        ]),
      ).toEqual([[null, "2025-11-01", "2026-10-31", "EUR"]]);
    });
    localStorage.removeItem("equori.locale");
  });

  it("asks for one account when the address names it", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": (req) => {
        asked.push(new URL(req.url).searchParams.get("account_id"));
        return json(200, contributionReturn);
      },
    });
    await renderApp(`/portfolio?account=${brokerID}`, { fetch });
    await waitFor(() => {
      expect(asked).toEqual([brokerID]);
    });
  });

  it("offers the parents of an investment account, the investment accounts and the reserves (A208 R7)", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("combobox", {
        name: catalogEn["portfolio.return.account"],
      }),
    );
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual([
      catalogEn["portfolio.return.whole"],
      "XP",
      "XP / XP MXRF11",
      "XP / XP PETR4",
      "Reserva",
    ]);
  });

  it("offers no whole portfolio to a book without a brokerage", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/accounts": () =>
        json(200, { items: accounts.filter((a) => a.name === "Reserva") }),
    });
    await renderApp("/portfolio", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("combobox", {
        name: catalogEn["portfolio.return.account"],
      }),
    );
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Reserva"]);
  });

  it("states that the return is undefined, with the reason (S127)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => problem(422, "return_undefined"),
    });
    await renderApp("/portfolio", { fetch });
    expect(
      await screen.findByText(catalogEn["portfolio.return.undefined"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["portfolio.return.undefinedWhy"]),
    ).toBeInTheDocument();
  });

  const usdPrice = (date: string) => ({
    instrument: "USD",
    quote_instrument: "BRL",
    date,
    value: "5.50",
    source: "manual",
  });

  it("PC22: says which rate is missing, from when it exists, and starts the period there", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": (req) =>
        new URL(req.url).searchParams.get("from") === "2026-09-25"
          ? json(200, plainReturn)
          : problem(422, "price_missing"),
      "GET /api/v1/prices": () =>
        json(200, {
          items: [usdPrice("2026-10-01"), usdPrice("2026-09-24")],
        }),
    });
    const { router } = await renderApp("/portfolio?value_in=USD", {
      fetch,
      today: "2026-10-24",
    });

    expect(
      await screen.findByText(
        catalogEn["holdings.missing.starts"]
          .replaceAll("{currency}", "USD")
          .replaceAll("{base}", "BRL")
          .replace("{first}", "09/24/2026")
          .replace("{from}", "10/25/2025"),
      ),
    ).toBeInTheDocument();

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: catalogEn["holdings.missing.fromFirst"].replace(
          "{date}",
          "09/25/2026",
        ),
      }),
    );

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        from: "2026-09-25",
      });
    });
    expect(
      await within(await performance()).findByText("5.00%"),
    ).toBeInTheDocument();
  });

  it("PC22: goes back to the base currency and links to the rates to record", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => problem(422, "price_missing"),
      "GET /api/v1/prices": () => json(200, { items: [] }),
    });
    const { router } = await renderApp("/portfolio?value_in=USD", {
      fetch,
      today: "2026-10-24",
    });

    expect(
      await screen.findByText(
        catalogEn["holdings.missing.none"]
          .replace("{currency}", "USD")
          .replaceAll("{base}", "BRL")
          .replace("{from}", "10/25/2025")
          .replace("{to}", "10/24/2026"),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["holdings.missing.record"] }),
    ).toHaveAttribute("href", "/instruments/USD");

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: catalogEn["holdings.missing.inBase"].replace("{base}", "BRL"),
      }),
    );

    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty("value_in");
    });
  });

  it("PC22: in the base currency, says a price of an investment is missing", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => problem(422, "price_missing"),
    });
    await renderApp("/portfolio", { fetch });

    expect(
      await screen.findByText(catalogEn["holdings.missing.own"]),
    ).toBeInTheDocument();
  });

  it("names the index the report compares with, whichever the region has", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () =>
        json(200, {
          ...marketReturn,
          benchmark: { ...marketReturn.benchmark, index: "sofr" },
          inflation: undefined,
        }),
    });
    const { container } = await renderApp("/portfolio", { fetch });
    const section = await performance();

    await within(section).findByText(
      catalogEn["portfolio.yield.group.index"].replace("{index}", "SOFR"),
    );
    expect(container.textContent).not.toMatch(/CDI|IPCA/);
  });

  it("names no index for a region without one", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () =>
        json(200, { ...plainReturn, period_bp: 480 }),
    });
    const { container } = await renderApp("/portfolio", { fetch });
    const section = await performance();

    await within(section).findByText("4.80%");
    expect(container.textContent).not.toMatch(/CDI|IPCA|SOFR/);
  });

  it("blocks a period above 366 days without asking for it", async () => {
    const asked: string[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": (req) => {
        asked.push(req.url);
        return json(200, contributionReturn);
      },
    });
    await renderApp("/portfolio?from=2025-10-01&to=2026-10-17", { fetch });
    expect(
      await screen.findByText(catalogEn["portfolio.return.periodTooLong"]),
    ).toBeInTheDocument();
    expect(asked).toEqual([]);
  });

  it("blocks a start after the end", async () => {
    await renderApp("/portfolio?from=2026-10-17&to=2026-10-01", {
      fetch: portfolioApi(),
    });
    expect(
      await screen.findByText(catalogEn["portfolio.return.periodReversed"]),
    ).toBeInTheDocument();
  });

  it("masks the amounts and keeps the rate in privacy mode", async () => {
    localStorage.setItem("equori.privacy", "hidden");
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, contributionReturn),
    });
    try {
      const { container } = await renderApp("/portfolio", { fetch });
      await screen.findByText("3.33%");
      await openMethod();
      await screen.findAllByText(catalogEn["holdings.method.personal"]);
      expect(container.textContent).not.toContain("2,050.00");
      expect(container.textContent).not.toContain("1,000.00");
    } finally {
      localStorage.removeItem("equori.privacy");
    }
  });
});
