import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FundReport } from "@/features/instruments";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { formatReferenceMonth, numberFormatter } from "@/i18n/format";
import { json } from "@/testing/fake-api";
import { instrumentsApi } from "@/testing/instruments-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

const sourceUrl = "https://dados.cvm.gov.br/dataset/fii-doc-inf_mensal";

function months(count: number, skip = 0) {
  return Array.from({ length: count }, (_, k) => {
    const index = 9 - k + 12 * 2026 - skip;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;

    return {
      period: `${String(year)}-${String(month).padStart(2, "0")}-01`,
      delivered: k === 0 ? "2026-11-13" : null,
      net_assets: k === 0 ? 765689937148 : null,
      holders: k === 0 ? 633787 : null,
      units: null,
      unit_book_value: "110.000000000000",
      admin_fee: k === 0 ? "0.000465000000" : null,
      month_yield: "0.010000000000",
      month_amortization: null,
    };
  });
}

function reportOf(periods: ReturnType<typeof months>) {
  return {
    source: "br_cvm_fii",
    source_url: sourceUrl,
    exchange: "B3SA",
    code: "HGLG11",
    currency: "BRL",
    identifier: "11728688000147",
    name: "CSHG Logística FII",
    segment: "Logística",
    periods,
  };
}

const realCurve = {
  id: "br_tesouro_ipca",
  kind: "real",
  index: "ipca",
  currency: "BRL",
  base_date: "2026-11-16",
  source: "br_tesouro",
  points: [{ maturity: "2045-05-15", rate: "0.069000000000" }],
};

const price = {
  instrument: "HGLG11",
  quote_instrument: "BRL",
  date: "2026-11-17",
  value: "158.00",
  source: "b3_cotahist",
};

function api(
  options: { periods?: ReturnType<typeof months>; curves?: unknown[] } = {},
) {
  const { periods = months(12), curves = [realCurve] } = options;

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
    "GET /api/v1/fund-reports": () =>
      json(200, {
        items: periods.length === 0 ? [] : [reportOf(periods)],
        candidates: [],
      }),
    "GET /api/v1/curves": () => json(200, { items: curves }),
    "GET /api/v1/prices": () => json(200, { interval: "day", items: [price] }),
  });
}

function show(
  fetch: typeof globalThis.fetch,
  opts: { quote?: string; today?: string } = {},
) {
  return renderWithProviders(
    <FundReport code="HGLG11" quote={opts.quote ?? "BRL"} />,
    { fetch, today: opts.today ?? "2026-11-18" },
  );
}

const percent = (value: number, signed = false) =>
  numberFormatter("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...(signed ? { signDisplay: "exceptZero" } : {}),
  }).format(value);

describe("Fund report on the instrument page", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("draws the figures of the latest report, the break-even line and the source", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    show(api());

    expect(
      await screen.findByRole("heading", { name: "Informe do fundo" }),
    ).toBeInTheDocument();
    const month = formatReferenceMonth("2026-10", "pt-BR");
    expect(
      await screen.findByText(
        new RegExp(
          `^Logística · informe de ${month} · entregue em 13/11/2026$`,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("CSHG Logística FII")).toHaveAttribute(
      "title",
      "CSHG Logística FII",
    );
    expect(await screen.findByText("1,44")).toBeInTheDocument();
    expect(screen.getAllByText("preço de 17/11/2026")).toHaveLength(2);
    expect(screen.getByText("633.787")).toBeInTheDocument();
    expect(screen.getByText(percent(0.083544))).toBeInTheDocument();
    const line = await screen.findByText(/Tesouro IPCA\+ 2045/);
    expect(line).toHaveTextContent(percent(0.069));
    expect(line).toHaveTextContent("16/11/2026");
    expect(line).toHaveTextContent(percent(-0.013423, true));
    expect(screen.getByText(/O valor distribuído é estimado/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Abrir o conjunto de dados da fonte/ }),
    ).toHaveAttribute("href", sourceUrl);
    expect(screen.queryByText("informe desatualizado")).not.toBeInTheDocument();
  });

  it("draws nothing for an instrument without a report", async () => {
    const { container } = show(api({ periods: [] }));

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("writes the price figures in words when the quote is in another currency", async () => {
    show(api(), { quote: "USD" });

    expect(
      await screen.findAllByText(catalogPtBR["fundReport.otherCurrency"]),
    ).toHaveLength(3);
    expect(screen.queryByText(/Tesouro IPCA\+ 2045/)).not.toBeInTheDocument();
  });

  it("writes the missing curve in words", async () => {
    show(api({ curves: [] }));

    expect(
      await screen.findByText(catalogPtBR["fundReport.noCurve"]),
    ).toBeInTheDocument();
  });

  it("writes the yearly figures in words with fewer than twelve reports", async () => {
    show(api({ periods: months(11) }));

    expect(
      await screen.findAllByText(catalogPtBR["fundReport.fewReports"]),
    ).toHaveLength(3);
  });

  it("marks a report whose delivery is late", async () => {
    show(api(), { today: "2026-12-22" });

    expect(
      await screen.findByText(catalogPtBR["fundReport.stale"]),
    ).toBeInTheDocument();
  });

  it("shows the book value in privacy mode", async () => {
    hideAmounts();
    show(api());

    await screen.findByText("Valor patrimonial da cota");
    expect(await screen.findByText(/110,00/)).toBeInTheDocument();
  });
});
