import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { brl, cashID } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

// The six contracts of the approved mock (FC36), values in minor units of BRL.
const contracts = [
  ["CDBX", "CDB Banco X", 20000000, "cdi", "2028-03-02"],
  ["LCIX", "LCI Banco X", 10000000, "cdi", "2027-05-10"],
  ["LFX", "LF Banco X", 3000000, "cdi", "2030-08-01"],
  ["DEBY", "Debênture Y", 5000000, "ipca", "2032-06-15"],
  ["NTNB35", "Tesouro IPCA+ 2035", 2000000, "ipca", "2035-05-15"],
  ["CDBZ", "CDB Banco Z", 1230000, undefined, "2026-12-15"],
] as const;

const event = (
  instrument: string,
  date: string,
  kind: string,
  state: string,
  gross?: number,
) => ({
  account_id: cashID,
  instrument,
  date,
  kind,
  quantity: { amount: 100, currency: instrument },
  rate_missing: gross === undefined,
  state,
  ...(gross === undefined ? {} : { gross: brl(gross) }),
});

const events = [
  event("LFX", "2026-11-10", "interest", "due", 82000),
  event("DEBY", "2026-12-02", "interest", "upcoming", 158000),
  event("CDBZ", "2026-12-15", "maturity", "upcoming", 1342000),
  event("CDBX", "2027-01-05", "interest", "upcoming", 60683),
  event("NTNB35", "2027-02-01", "interest", "upcoming"),
];

const issuer = (
  name: string,
  market: number,
  covered: number,
  excess = 0,
  sovereign = 0,
) => ({
  issuer: name,
  market_value: brl(market),
  covered_value: brl(covered),
  uncovered_value: brl(market - covered - sovereign),
  sovereign_value: brl(sovereign),
  limit: brl(25000000),
  excess: brl(excess),
});

const guarantee = {
  name: "FGC",
  limit_per_issuer: brl(25000000),
  limit_per_period: brl(100000000),
  period_years: 4,
  covered: ["cdb", "lci"],
};

const report = {
  date: "2026-11-18",
  issuers: [
    issuer("Banco X", 33000000, 30000000, 5000000),
    issuer("Debênture Y", 5000000, 0),
    issuer("Tesouro", 2000000, 0, 0, 2000000),
    issuer("Banco Z", 1230000, 1230000),
  ],
  guarantee,
  period_note: false,
  missing_prices: [],
};

function fixedIncomeApi(
  routes: Parameters<typeof portfolioApi>[0] = {},
  withContracts = true,
) {
  if (!withContracts) return portfolioApi(routes);

  return portfolioApi({
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          ...contracts.map(([code, name]) => ({
            code,
            name,
            type: "fixed_income",
            scale: 2,
            quote_currency: "BRL",
          })),
        ],
      }),
    "GET /api/v1/positions": () =>
      json(200, {
        quote_warnings: [],
        items: contracts.map(([code, , value]) => ({
          account_id: cashID,
          instrument: code,
          quantity: { amount: value, currency: code },
          cost_basis: brl(value),
          average_cost: "1.0000",
          market_value: brl(value),
        })),
      }),
    "GET /api/v1/indexes": () =>
      json(200, {
        items: [
          { id: "cdi", period: "day" },
          { id: "ipca", period: "month" },
        ],
      }),
    "GET /api/v1/fixed-income-events": () => json(200, { items: events }),
    "GET /api/v1/issuer-exposure": () => json(200, report),
    ...Object.fromEntries(
      contracts.map(([code, , , index, matures]) => [
        `GET /api/v1/instruments/${code}/terms`,
        () =>
          json(200, {
            matures_on: matures,
            ...(index === undefined ? {} : { index_id: index }),
          }),
      ]),
    ),
    ...routes,
  });
}

const collapsedKey = "equori.portfolio.fixedIncome.collapsed";

const portuguese = JSON.stringify({ language: "pt", region: "BR" });

const panel = async (name: string) => screen.findByRole("region", { name });

const texts = (nodes: Iterable<Element>) =>
  [...nodes].map((n) => n.textContent.replaceAll("\u00a0", " "));

describe("Fixed income panel", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem(collapsedKey);
  });

  it("FC36: draws the verdict and the four blocks of the mock, in order", async () => {
    localStorage.setItem("equori.locale", portuguese);
    await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi(),
    });
    const root = await panel("Renda fixa");
    await within(root).findByText("R$ 50.000,00 acima do FGC no Banco X");

    expect(
      within(root)
        .getAllByRole("heading")
        .map((h) => h.textContent),
    ).toEqual([
      "Renda fixa",
      "Como rende",
      "Quando volta",
      "Próximos 90 dias",
      "Por emissor e garantia",
    ]);
    expect(texts([root])[0]).toContain("R$ 412.300,00 em 6 contratos");
    expect(texts([root])[0]).toContain(
      "1 pagamento a registrar · vence em 15/12: R$ 13.420,00",
    );

    const kinds = await panel("Como rende");
    expect(texts(kinds.querySelectorAll("dd"))).toEqual([
      "R$ 330.000,00 · 80%",
      "R$ 70.000,00 · 17%",
      "R$ 12.300,00 · 3%",
    ]);

    const ladder = await panel("Quando volta");
    expect(texts(within(ladder).getAllByRole("listitem"))).toEqual([
      "2026R$ 12.300,00",
      "2027R$ 100.000,00",
      "2028R$ 200.000,00",
      "2030R$ 30.000,00",
      "2032R$ 50.000,00",
      "2035R$ 20.000,00",
    ]);

    const next = await panel("Próximos 90 dias");
    const rows = [...next.querySelectorAll("dt")];
    expect(texts(rows)).toEqual([
      "10/11LF Banco XJuros",
      "02/12Debênture YJuros",
      "15/12CDB Banco ZVencimento",
      "05/01CDB Banco XJuros",
      "01/02Tesouro IPCA+ 2035Juros",
    ]);
    expect(
      within(next).getByRole("link", { name: "Registrar · LF Banco X" }),
    ).toHaveAttribute("href", expect.stringContaining("/transactions/new?"));
    expect(within(next).queryByText("A registrar")).not.toBeInTheDocument();
    expect(texts(next.querySelectorAll("dd"))).toEqual([
      "RegistrarR$ 820,00",
      "R$ 1.580,00",
      "R$ 13.420,00",
      "R$ 606,83",
      "Taxa não publicada",
    ]);

    const issuers = await panel("Por emissor e garantia");
    expect(texts(within(issuers).getAllByRole("listitem")).slice(0, 4)).toEqual(
      [
        "Banco X+R$ 50.000,00",
        "Debênture YSem cobertura",
        "TesouroTítulo público",
        "Banco ZCoberto",
      ],
    );
    expect(texts([issuers])[0]).toContain("FGC: R$ 250.000,00 por emissor");
    expect(texts([issuers])[0]).toContain(
      "Usados R$ 312.300,00 de R$ 1.000.000,00 em 4 anos",
    );
    expect(texts([issuers])[0]).toContain("Limite por emissor");
  });

  it("minimizes to the heading and the start of the body, and keeps the choice", async () => {
    localStorage.setItem("equori.locale", portuguese);
    const first = await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi(),
    });
    const root = await panel("Renda fixa");
    await within(root).findByText("R$ 50.000,00 acima do FGC no Banco X");
    const body = root.querySelector("[data-peek]");

    expect(body).toHaveAttribute("data-peek", "open");
    expect(body).not.toHaveAttribute("inert");

    await userEvent.click(
      within(root).getByRole("button", { name: "Minimizar Renda fixa" }),
    );

    expect(body).toHaveAttribute("data-peek", "closed");
    expect(body).toHaveAttribute("inert");
    expect(
      within(root).getByRole("heading", { name: "Renda fixa" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(collapsedKey)).toBe("true");

    first.unmount();
    await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi(),
    });
    const again = await panel("Renda fixa");

    expect(again.querySelector("[data-peek]")).toHaveAttribute(
      "data-peek",
      "closed",
    );

    await userEvent.click(
      within(again).getByRole("button", { name: "Ver mais" }),
    );

    expect(again.querySelector("[data-peek]")).toHaveAttribute(
      "data-peek",
      "open",
    );
    expect(localStorage.getItem(collapsedKey)).toBe("false");
  });

  it("FC36: draws no panel for a book without fixed income", async () => {
    const fetch = fixedIncomeApi({}, false);
    await renderApp("/portfolio", { fetch });
    await screen.findByRole("grid", { name: catalogEn["holdings.list"] });

    expect(
      screen.queryByRole("region", { name: catalogEn["fixedIncome.panel"] }),
    ).toBeNull();
    expect(fetch.calls.some((c) => c.includes("issuer-exposure"))).toBe(false);
  });

  it("FC36: draws the issuers without the guarantee in a region that has none", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const bare = {
      ...report,
      guarantee: undefined,
      issuers: report.issuers.map((i) => ({
        issuer: i.issuer,
        market_value: i.market_value,
        covered_value: i.covered_value,
        uncovered_value: i.uncovered_value,
        sovereign_value: i.sovereign_value,
      })),
    };
    await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi({
        "GET /api/v1/issuer-exposure": () => json(200, bare),
      }),
    });
    const issuers = await panel(catalogEn["fixedIncome.issuers"]);
    const items = await within(issuers).findAllByRole("listitem");

    expect(items).toHaveLength(4);
    expect(texts(items)[0]).toContain("Banco X");
    expect(issuers.textContent).not.toContain("per issuer");
    expect(issuers.textContent).not.toContain(
      catalogEn["fixedIncome.issuers.mark"],
    );
    expect(issuers.textContent).not.toContain(
      catalogEn["fixedIncome.issuers.covered"],
    );
  });

  it("FC36: says so when the window holds no payment", async () => {
    await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi({
        "GET /api/v1/fixed-income-events": () => json(200, { items: [] }),
      }),
    });
    const next = await panel(catalogEn["fixedIncome.next"]);

    expect(
      await within(next).findByText(catalogEn["fixedIncome.next.none"]),
    ).toBeInTheDocument();
  });

  it("FC36: names a payment whose rate is not published", async () => {
    await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi(),
    });
    const next = await panel(catalogEn["fixedIncome.next"]);

    expect(
      await within(next).findByText(catalogEn["fixedIncome.next.rateMissing"]),
    ).toBeInTheDocument();
  });

  it("FC36: writes no rate notice for a fixed-rate payment without a value", async () => {
    await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi({
        "GET /api/v1/fixed-income-events": () =>
          json(200, {
            items: [event("CDBZ", "2026-12-15", "maturity", "upcoming")],
          }),
      }),
    });
    const next = await panel(catalogEn["fixedIncome.next"]);

    expect(await within(next).findByText(/CDB Banco Z/)).toBeInTheDocument();
    expect(
      within(next).queryByText(catalogEn["fixedIncome.next.rateMissing"]),
    ).not.toBeInTheDocument();
  });

  it("FC36: names a payment of a holding that has no market value", async () => {
    await renderApp("/portfolio", {
      today: "2026-11-18",
      fetch: fixedIncomeApi({
        "GET /api/v1/positions": () =>
          json(200, {
            quote_warnings: [],
            items: contracts.map(([code, , value]) => ({
              account_id: cashID,
              instrument: code,
              quantity: { amount: value, currency: code },
              cost_basis: brl(value),
              average_cost: "1.0000",
              ...(code === "LFX" ? {} : { market_value: brl(value) }),
            })),
          }),
      }),
    });
    const next = await panel(catalogEn["fixedIncome.next"]);

    expect(await within(next).findByText(/LF Banco X/)).toBeInTheDocument();
    expect(within(next).queryByText(/LFX/)).not.toBeInTheDocument();
  });
});
