import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";

import { CompanyReport } from "@/features/instruments";
import { numberFormatter } from "@/i18n/format";
import { json } from "@/testing/fake-api";
import { instrumentsApi } from "@/testing/instruments-api";
import { renderWithProviders } from "@/testing/render-app";

type Period = components["schemas"]["CompanyReportPeriod"];
type Report = components["schemas"]["CompanyReport"];
type Figures = components["schemas"]["CompanyFigures"];

const sourceUrl = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp";
const signalsHeading = "Sinais de Piotroski, exercício de 2025 contra 2024";

describe("Company report on the instrument page", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("draws the multiples, the changes and the caution, and writes a reason in words", async () => {
    show(
      api(report(), [
        {
          source: "br_cvm_cia",
          source_url: sourceUrl,
          name: "Petrobras S.A.",
          currency: "BRL",
          price_date: "2026-11-17",
          price_earnings: { value: "3.916524", date: "2026-09-30" },
          price_earnings_range: { least: "1.7", greatest: "12.6", years: 5 },
          price_book: { reason: "shares" },
          return_on_equity: { reason: "missing" },
          net_margin: { reason: "missing" },
          net_debt_to_equity: { reason: "missing" },
          gross_profit_to_assets: { reason: "missing" },
          current_ratio: { reason: "missing" },
          revenue_growth: { reason: "missing" },
          positive_years: { positive: 5, years: 5 },
          profit: {
            state: "rate",
            rate: "0.316865",
            date: "2026-09-30",
            months: 9,
          },
          revenue: { reason: "short_history" },
        },
      ]),
    );

    expect(await screen.findByText("3,9")).toBeInTheDocument();
    expect(card("P/L")).toHaveTextContent("faixa de 5 exercícios: 1,7 a 12,6");
    expect(card("P/VP")).toHaveTextContent("número de ações não conferido");
    const profit = card("Lucro contra o ano anterior");
    expect(profit).toHaveTextContent("subiu 32%");
    expect(profit).toHaveTextContent("9 meses até 30/09/2026");
    expect(card("Receita contra o ano anterior")).toHaveTextContent(
      "histórico curto",
    );
    expect(
      screen.getByText(
        "Preço de 17/11/2026. Um P/L baixo também pode indicar que se espera queda do lucro.",
      ),
    ).toBeInTheDocument();
  });

  it("draws the statements, the four figures and the nine signals", async () => {
    show(api(report()));

    expect(
      await screen.findByRole("heading", {
        name: "Demonstrações da companhia",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "consolidadas · 9 meses até 30/09/2026 · entregue em 28/10/2026",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Petrobras S.A.")).toHaveAttribute(
      "title",
      "Petrobras S.A.",
    );
    expect(card("Retorno sobre o patrimônio")).toHaveTextContent(
      percent(0.097),
    );
    expect(card("Margem líquida")).toHaveTextContent(percent(9700 / 110000));
    expect(screen.getAllByText("12 meses até 30/09/2026")).toHaveLength(2);
    expect(card("Dívida líquida sobre patrimônio")).toHaveTextContent("0,30");
    expect(screen.getByText("balanço de 30/09/2026")).toBeInTheDocument();
    expect(card("Anos com lucro")).toHaveTextContent("2 de 2");
    expect(screen.getByText("dos 2 últimos exercícios")).toBeInTheDocument();
    expect(screen.getByText(signalsHeading)).toBeInTheDocument();

    const rows = within(
      screen.getByRole("list", { name: signalsHeading }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(9);
    expect(rows[0]).toHaveTextContent("ROA positivo");
    expect(rows[0]).toHaveTextContent(percent(0.07));
    expect(rows[0]).toHaveTextContent("sim");
    expect(screen.getByText(/Os sinais de Piotroski são fatos/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Abrir o conjunto de dados da fonte/ }),
    ).toHaveAttribute("href", sourceUrl);
  });

  it("writes the plan other in words and draws the signals every chart answers", async () => {
    show(api(report({ plan: "other" })));

    expect(await screen.findAllByText("não se aplica")).toHaveLength(2);
    expect(screen.getAllByText("plano de contas desta companhia")).toHaveLength(
      2,
    );
    expect(
      screen.getByText(
        "Os outros seis sinais de Piotroski não se aplicam ao plano de contas desta companhia.",
      ),
    ).toBeInTheDocument();

    const rows = within(
      screen.getByRole("list", { name: signalsHeading }),
    ).getAllByRole("listitem");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("ROA positivo");
  });

  it("draws nothing for an instrument without a report", async () => {
    const { container } = show(api(null));

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("writes a missing figure in words", async () => {
    show(api(report({ equity: null })));

    await screen.findByText("Retorno sobre o patrimônio");
    expect(card("Retorno sobre o patrimônio")).toHaveTextContent("sem dado");
  });
});

function show(fetch: typeof globalThis.fetch) {
  return renderWithProviders(<CompanyReport code="PETR4" />, {
    fetch,
    today: "2026-11-18",
  });
}

function api(item: Report | null, figures: Figures[] = []) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );

  return instrumentsApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        books_id: 1,
        role: "admin",
        language: "pt",
        region: "BR",
      }),
    "GET /api/v1/company-reports": () =>
      json(200, { items: item === null ? [] : [item] }),
    "GET /api/v1/company-figures": () => json(200, { items: figures }),
  });
}

// Three fiscal years (the years of the CR12 signals case) and the quarter of 2026 with its
// counterpart of 2025.
function report(over: { plan?: string; equity?: number | null } = {}): Report {
  const { plan = "standard", equity = 100000 } = over;

  return {
    source: "br_cvm_cia",
    source_url: sourceUrl,
    identifier: "33000167000101",
    name: "Petrobras S.A.",
    consolidated: true,
    plan,
    currency: "BRL",
    periods: [
      period("2026-09-30", 9, {
        delivered: "2026-10-28",
        net_income: 9000,
        revenue: 80000,
        short_debt: 10000,
        long_debt: 30000,
        cash: 5000,
        short_investments: 5000,
        equity,
      }),
      period("2025-12-31", 12, {
        net_income: 7700,
        operating_cash_flow: 9000,
        total_assets: 120000,
        long_debt: 28000,
        current_assets: 45000,
        current_liabilities: 20000,
        shares_issued: 100,
        revenue: 100000,
        gross_profit: 32000,
      }),
      period("2025-09-30", 9, { net_income: 7000, revenue: 70000 }),
      period("2024-12-31", 12, {
        net_income: 5000,
        operating_cash_flow: 6000,
        total_assets: 110000,
        long_debt: 30000,
        current_assets: 40000,
        current_liabilities: 20000,
        shares_issued: 100,
        revenue: 90000,
        gross_profit: 27000,
      }),
      period("2023-12-31", 12, { total_assets: 100000 }),
    ],
  };
}

function period(
  date: string,
  months: number,
  accounts: Partial<Period>,
): Period {
  return {
    period: date,
    months,
    delivered: null,
    total_assets: null,
    current_assets: null,
    cash: null,
    short_investments: null,
    current_liabilities: null,
    short_debt: null,
    long_debt: null,
    equity: null,
    revenue: null,
    gross_profit: null,
    net_income: null,
    operating_cash_flow: null,
    shares_issued: null,
    shares_treasury: null,
    ...accounts,
  };
}

function card(label: string): HTMLElement {
  const found = screen.getByText(label).closest('[data-ui="stat-card"]');

  if (!(found instanceof HTMLElement)) {
    throw new Error(`no card for ${label}`);
  }

  return found;
}

function percent(value: number): string {
  return numberFormatter("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
