import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, checkingID } from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const path = "/api/v1/market-data/institution-indicators";

const indicators = {
  source: "br_ifdata",
  source_url: "https://www3.bcb.gov.br/ifdata/",
  currency: "BRL",
  conglomerate_code: "C0084693",
  conglomerate_name: "NU PAGAMENTOS - PRUDENCIAL",
  limits: {
    basel: { minimum: "0.08", with_buffer: "0.105" },
    principal_capital: { minimum: "0.045", with_buffer: "0.07" },
    rule: "Resolução CMN 4.958/2021",
  },
  periods: [
    {
      period: "2026-06-30",
      basel: "0.0900000000",
      principal_capital: "0.1175995987",
      fixed_asset: null,
      equity: 2334461071736,
      net_income: 409304022539,
    },
    {
      period: "2026-03-31",
      basel: "0.1000000000",
      principal_capital: "0.1100000000",
      fixed_asset: null,
      equity: 2100000000050,
      net_income: 142054059415,
    },
    {
      period: "2025-12-31",
      basel: "0.1200000000",
      principal_capital: "0.1000000000",
      fixed_asset: null,
      equity: 2000000000000,
      net_income: 673205540738,
    },
  ],
};

function tab(name: keyof typeof catalogEn) {
  return screen.findByRole("tab", { name: new RegExp(`^${catalogEn[name]}`) });
}

describe("Institution tab", () => {
  it("draws the figures of the conglomerate with the data-base and a link to the source", async () => {
    const calls: string[] = [];
    await renderApp(`/accounts/${checkingID}?tab=institution`, {
      fetch: fakeApi(
        accountRoutes({
          [`GET ${path}`]: (req) => {
            calls.push(new URL(req.url).search);
            return json(200, indicators);
          },
        }),
      ),
    });

    expect(await tab("account.tab.institution")).toBeInTheDocument();
    expect(await screen.findByText("9.00%")).toBeInTheDocument();
    expect(screen.getByText("11.76%")).toBeInTheDocument();
    // A ratio the source leaves null reads as not informed, never as 0%.
    expect(
      screen.getByText(catalogEn["institution.notInformed"]),
    ).toBeInTheDocument();
    expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
    expect(screen.getByText(/NU PAGAMENTOS - PRUDENCIAL/)).toBeInTheDocument();
    // The Basel index is under the minimum with the buffer: the note says so in words (A237 L2).
    expect(
      screen.getByText("Below 10.50%, the minimum with buffer"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Minimum 4.50%, 7.00% with buffer"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Resolução CMN 4.958\/2021/)).toBeInTheDocument();
    // The trend of the three quarters of the Basel index.
    expect(
      screen.getByRole("img", { name: /^Basel index, last 3 quarters/ }),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: new RegExp(catalogEn["institution.link"]),
    });
    expect(link).toHaveAttribute("href", "https://www3.bcb.gov.br/ifdata/");
    expect(calls).toContain("?scheme=br_ispb&identifier=18236120");
  });

  it("draws no tab when the source holds no indicators for the institution", async () => {
    await renderApp(`/accounts/${checkingID}`, {
      fetch: fakeApi(
        accountRoutes({
          [`GET ${path}`]: () => problem(404, "not_found"),
        }),
      ),
    });

    expect(await tab("account.tab.imports")).toBeInTheDocument();
    expect(
      within(screen.getByRole("tablist")).queryByRole("tab", {
        name: new RegExp(`^${catalogEn["account.tab.institution"]}`),
      }),
    ).not.toBeInTheDocument();
  });
});
