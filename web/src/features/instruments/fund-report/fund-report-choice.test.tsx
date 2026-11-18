import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { FundReportChoice } from "@/features/instruments/fund-report/fund-report-choice";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { json, problem } from "@/testing/fake-api";
import { instrumentsApi } from "@/testing/instruments-api";
import { renderWithProviders } from "@/testing/render-app";

const instrument = {
  code: "ABCD11",
  name: "Fundo ABCD",
  type: "reit",
  scale: 0,
  quote_currency: "BRL",
  exchange: "BVMF",
  subtype: "fii",
  symbols: { yahoo_chart: "ABCD11.SA" },
} as unknown as components["schemas"]["Instrument"];

const candidates = [
  {
    source: "br_cvm_fii",
    identifier: "22222222000122",
    name: "FUNDO B",
    segment: "Outros",
  },
  {
    source: "br_cvm_fii",
    identifier: "33333333000133",
    name: "FUNDO C",
    segment: "",
  },
];

function api(
  options: {
    items?: unknown[];
    patch?: (body: unknown) => Response;
    answered?: () => void;
  } = {},
) {
  const {
    items = [],
    patch = () => json(200, instrument),
    answered = () => undefined,
  } = options;

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
    "GET /api/v1/fund-reports": () => {
      answered();
      return json(200, { items, candidates });
    },
    "PATCH /api/v1/instruments/ABCD11": async (req) => patch(await req.json()),
  });
}

function show(fetch: typeof globalThis.fetch) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );

  return renderWithProviders(<FundReportChoice instrument={instrument} />, {
    fetch,
  });
}

describe("Choice of the fund of a shared code (FR15)", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("lists the funds that share the code, each with its segment and identifier", async () => {
    show(api());

    expect(
      await screen.findByText(
        catalogPtBR["fundReport.choice.line"]
          .replace("{count}", "2")
          .replace("{code}", "ABCD11"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("FUNDO B")).toBeInTheDocument();
    expect(screen.getByText("Outros · 22222222000122")).toBeInTheDocument();
    expect(screen.getByText("33333333000133")).toBeInTheDocument();
  });

  it("links a fund by writing its identifier as the symbol of the source", async () => {
    const sent: unknown[] = [];
    show(
      api({
        patch: (body) => {
          sent.push(body);
          return json(200, instrument);
        },
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Vincular FUNDO C" }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          name: "Fundo ABCD",
          exchange: "BVMF",
          subtype: "fii",
          symbols: { yahoo_chart: "ABCD11.SA", br_cvm_fii: "33333333000133" },
        },
      ]);
    });
  });

  it("writes a refused link in words", async () => {
    show(api({ patch: () => problem(403, "forbidden") }));

    await userEvent.click(
      await screen.findByRole("button", { name: "Vincular FUNDO B" }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("draws nothing while a report reaches the instrument", async () => {
    let asked = 0;
    const { container } = show(
      api({
        items: [{ periods: [] }],
        answered: () => {
          asked += 1;
        },
      }),
    );

    await waitFor(() => {
      expect(asked).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
