import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import {
  instrumentFixtures,
  instrumentsApi as api,
} from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

describe("Instrument sources", () => {
  it("lists the pages that show a Brazilian stock, each opening in another tab", async () => {
    await renderApp("/instruments/PETR4", { fetch: petrobras() });
    const list = await screen.findByRole("list", {
      name: catalogEn["instrument.links.title"],
    });
    const links = within(list).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://www.google.com/finance/quote/PETR4:BVMF",
      "https://finance.yahoo.com/quote/PETR4.SA/",
      "https://www.fundamentus.com.br/detalhes.php?papel=PETR4",
      "https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx",
    ]);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(links[0]).toHaveTextContent("Google Finance");
    expect(links[0]).toHaveTextContent("Quote and news");
    expect(links[0]).toHaveTextContent("google.com");
  });

  it("states that the address holds no amount, name or account", async () => {
    await renderApp("/instruments/PETR4", { fetch: petrobras() });

    expect(
      await screen.findByText(catalogEn["instrument.links.hint"]),
    ).toBeInTheDocument();
  });

  it("draws nothing for an instrument no source covers", async () => {
    await renderApp("/instruments/CDB1", { fetch: api() });
    await screen.findByRole("heading", { name: "CDB Bank One" });

    expect(
      screen.queryByRole("heading", {
        name: catalogEn["instrument.links.title"],
      }),
    ).not.toBeInTheDocument();
  });
});

function petrobras() {
  const petr = instrumentFixtures.find((i) => i.code === "PETR4");

  return api({
    "GET /api/v1/instruments/PETR4": () =>
      json(200, { ...petr, exchange: "BVMF" }),
  });
}
