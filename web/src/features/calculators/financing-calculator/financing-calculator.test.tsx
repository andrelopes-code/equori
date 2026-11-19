import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const open = (search: string, region?: string, language = "en") =>
  renderApp(`/calculators/financing?${search}`, {
    fetch: fakeApi({
      ...calculatorApiRoutes(),
      ...(region === undefined
        ? {}
        : {
            "GET /api/v1/me": () =>
              json(200, {
                id: 1,
                email: "a@b.c",
                role: "admin",
                language,
                region,
              }),
          }),
    }),
  });

async function openDetails() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: new RegExp(catalogEn["calc.financing.details"]),
    }),
  );
}

const loan = "amount=1000000&rate=1&period=month&months=12";

describe("Financing calculator", () => {
  // The profile's region is kept in the browser between renders.
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("compares Price and SAC side by side", async () => {
    await open(loan);
    const table = await screen.findByRole("table", {
      name: catalogEn["calc.financing.compare"],
    });
    const row = (label: string) =>
      within(table).getByRole("rowheader", { name: label }).closest("tr")
        ?.textContent ?? "";
    expect(
      within(table).getByRole("columnheader", {
        name: catalogEn["calc.financing.figure"],
      }),
    ).toBeInTheDocument();
    expect(row(catalogEn["calc.financing.first"])).toContain("888.49");
    expect(row(catalogEn["calc.financing.first"])).toContain("933.33");
    expect(row(catalogEn["calc.financing.last"])).toContain("888.47");
    expect(row(catalogEn["calc.financing.interest"])).toContain("661.86");
    expect(row(catalogEn["calc.financing.interest"])).toContain("650.00");
  });

  it("reads a term typed in years as its months", async () => {
    await open("amount=1000000&rate=1&period=month&months=1&monthsUnit=year");
    await openDetails();
    const grid = await screen.findByRole("table", {
      name: catalogEn["calc.financing.priceTable"],
    });
    expect(within(grid).getAllByRole("row")).toHaveLength(13);
    expect(within(grid).getAllByRole("row")[1]?.textContent).toContain(
      "888.49",
    );
  });

  it("names the systems Price and SAC only for Brazil", async () => {
    const { unmount } = await open(loan);
    expect(
      await screen.findByRole("table", {
        name: catalogEn["calc.financing.compare"],
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(catalogEn["calc.financing.br.sac"])).toBeNull();
    unmount();
    await open(loan, "BR");
    const table = await screen.findByRole("table", {
      name: catalogEn["calc.financing.br.compare"],
    });
    expect(
      within(table).getByRole("columnheader", {
        name: catalogEn["calc.financing.br.sac"],
      }),
    ).toBeInTheDocument();
  });

  // CR8: the schedules open in a collapsible, one tab per system.
  it("lists the 12 months of each system", async () => {
    await open(loan);
    await openDetails();
    for (const [tab, key] of [
      ["calc.financing.price", "calc.financing.priceTable"],
      ["calc.financing.sac", "calc.financing.sacTable"],
    ] as const) {
      await userEvent.click(
        await screen.findByRole("tab", { name: catalogEn[tab] }),
      );
      const grid = await screen.findByRole("table", { name: catalogEn[key] });
      // The header row and one row per month.
      expect(within(grid).getAllByRole("row")).toHaveLength(13);
    }
  });

  // CR5: the prepayment is two choice rows and a note, not a list of six figures.
  it("shows what a prepayment saves in each use", async () => {
    await open(`${loan}&prepayMonth=6&prepayAmount=200000`);
    const rows = await screen.findAllByRole("img", {
      name: new RegExp(catalogEn["calc.choice.saved"]),
    });
    expect(rows).toHaveLength(2);
    // 181.72 - 74.20
    expect(rows[0]).toHaveAccessibleName(
      `${catalogEn["calc.financing.prepay.term"]}: ${catalogEn["calc.choice.saved"]} R$107.52`,
    );
    expect(
      screen.getByText("Ends in 4 months, 2 fewer", { exact: false }),
    ).toBeVisible();
    expect(
      screen.getByText("Installment falls to R$543.39", { exact: false }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Balance after the payment R$3,149.20 · remaining interest without it R$181.72",
      ),
    ).toBeVisible();
  });

  // CR6: the rate and the term are a 7rem value beside their unit select.
  it("lays the rate and the term out as a value beside its unit", async () => {
    await open(loan);
    await screen.findByText(catalogEn["calc.solve.legend"]);
    for (const name of ["rate", "months"]) {
      const input = document.querySelector(`input[name="${name}"]`);
      expect(input?.closest('[class*="_unitValue_"]')).not.toBeNull();
    }
    expect(document.querySelectorAll('[class*="_unitSelect_"]')).toHaveLength(
      2,
    );
    expect(
      screen.getByText(catalogEn["calc.financing.solve.hint"]),
    ).toBeVisible();
  });

  it("states the yearly rate only when the rate is solved", async () => {
    await open(loan);
    await screen.findByText(catalogEn["calc.solve.legend"]);
    expect(
      screen.queryByText(catalogEn["calc.financing.solved.annual"]),
    ).toBeNull();
  });

  it("opens the prepayment group when only its amount is in the address", async () => {
    await open(`${loan}&prepayAmount=200000`);
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.financing.prepay.remove"],
      }),
    ).toBeVisible();
  });

  it("opens the prepayment group only by its choice", async () => {
    await open(loan);
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.financing.prepay.add"],
      }),
    ).toBeVisible();
    expect(screen.queryByText(catalogEn["calc.options"])).toBeNull();
  });

  it("answers first in pt-BR: the installment, the facts and the sentence", async () => {
    await open(
      "amount=30000000&rate=11.5&months=360&prepayMonth=24&prepayAmount=2000000",
      "BR",
      "pt",
    );
    expect(
      await screen.findByText("R$ 2.842,24", { selector: "p" }),
    ).toBeVisible();
    for (const value of ["R$ 1.023.197,89", "R$ 723.197,89", "R$ 229.755,77"])
      expect(screen.getByText(value, { selector: "dd" })).toBeVisible();
    expect(
      screen.getByText(
        "por 360 meses. Em SAC, a primeira é R$ 3.567,07 e cai até R$ 842,13.",
      ),
    ).toBeVisible();
    expect(screen.getByText("R$ 247.855,59")).toBeVisible();
  });

  // CR4: the empty answer names the inputs still missing, in reading order.
  it("names the missing inputs in the sentence", async () => {
    await open("", "BR", "pt");
    expect(
      await screen.findByText(
        "Preencha valor financiado, taxa de juros e prazo para ver a prestação.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(catalogPtBR["calc.options"])).toBeNull();
  });

  // CR3: the solved value is the figure of the answer, under its lead.
  it("solves the rate from the installment", async () => {
    await open("solve=rate&amount=1000000&months=12&installment=88849");
    expect(
      await screen.findByText(catalogEn["calc.financing.solved.rate"]),
    ).toBeVisible();
    expect(await screen.findByText("1.0000%")).toBeVisible();
    // The yearly equivalent of 1% a month (the installment is rounded, so the rate is near it).
    expect(
      screen.getByText(catalogEn["calc.financing.solved.annual"]),
    ).toBeVisible();
    expect(screen.getByText(/^12\.68\d*%$/)).toBeVisible();
  });
});
