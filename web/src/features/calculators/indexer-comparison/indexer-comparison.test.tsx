import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { breakEven } from "@/features/calculators/indexer-comparison/break-even/break-even";
import { compare } from "@/features/calculators/indexer-comparison/compare";
import { IndexerComparison } from "@/features/calculators/indexer-comparison/indexer-comparison";
import type { IndexData } from "@/features/calculators/indexer-comparison/security";
import { expectedIndexRate } from "@/features/calculators/indexer-comparison/security-rate";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import {
  calculatorApiRoutes,
  cdiFixture,
  prefixedCurveFixture,
} from "@/testing/calculator-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";

const survey = "2026-11-13";
const cdi = {
  ...cdiFixture(),
  expectations: {
    survey_date: survey,
    items: [{ date: "2026-11-18", rate: "0.1" }],
  },
};
const cdiData: IndexData = {
  id: "cdi",
  period: "day",
  rates: cdi.rates.map((r) => ({ date: r.date, rate: Number(r.rate) })),
  points: [{ date: "2026-11-18", rate: 0.1 }],
  surveyDate: survey,
  dailySpread: false,
};

function open(
  routes = calculatorApiRoutes([cdi], [prefixedCurveFixture()]),
  currency = "BRL",
  region = "BR",
) {
  return renderWithRouter(
    <IndexerComparison amount={1_000_000} currency={currency} />,
    {
      path: "/calculators/indexer-comparison",
      today: "2026-11-17",
      fetch: fakeApi({
        ...routes,
        "GET /api/v1/me": () =>
          json(200, {
            id: 1,
            email: "a@b.c",
            role: "admin",
            books_id: 1,
            book_role: "owner",
            language: "pt",
            region,
          }),
        "GET /api/v1/instruments": () =>
          json(200, {
            items: [
              { code: "BRL", type: "currency", scale: 2, name: "Real" },
              { code: "USD", type: "currency", scale: 2, name: "Dollar" },
            ],
          }),
      }),
    },
  );
}

const norm = (s: string) => s.replaceAll(String.fromCharCode(160), " ");
const rateBoxes = () =>
  screen.findAllByRole("textbox", {
    name: catalogPtBR["calc.indexerComparison.rate"],
  });

// A pt-BR amount of minor units, as the screen writes it.
const brl = (minor: number) =>
  norm(
    (minor / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    }),
  );

async function figure(lead: string): Promise<string> {
  const node = await screen.findByText(lead);
  return norm(node.nextElementSibling?.textContent ?? "");
}

async function typeRates(first: string, second: string) {
  const user = userEvent.setup();
  const boxes = await rateBoxes();
  const [box1, box2] = boxes;
  if (box1 === undefined || box2 === undefined)
    throw new Error("no rate boxes");
  await user.type(box1, first);
  await user.type(box2, second);
  return user;
}

describe("IndexerComparison", () => {
  it("writes each typed security in words with its net yield", async () => {
    open();
    await typeRates("8", "140");

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(
      await within(table).findByText("Prefixado 8,00% a.a."),
    ).toBeInTheDocument();
    expect(within(table).getByText("140% do CDI")).toBeInTheDocument();
    // 10,000.00 at 8% for 731 days: gross 1,666.46, tax 15% 249.97, net 1,416.49.
    await waitFor(() => {
      expect(norm(rows[1]?.textContent ?? "")).toContain("R$ 1.416,49");
    });
    expect(norm(rows[1]?.textContent ?? "")).toContain("R$ 249,97");
  });

  it("states the break-even, the expected rate and the market rate", async () => {
    open();
    await typeRates("8", "140");

    const data = { ...cdiData };
    const x = breakEven({
      security: { form: "percent", index: "cdi", rate: 1.4, taxed: true },
      data,
      reference: { form: "fixed", rate: 0.08, taxed: true },
      referenceRate: 0.08,
      days: 731,
      taxBp: 1500,
    });
    const expected = expectedIndexRate(data, 25);
    const pct = (v: number | null) =>
      ((v ?? Number.NaN) * 100).toFixed(2).replace(".", ",");

    expect(
      await screen.findByText(
        `140% do CDI empata com Prefixado 8,00% a.a. se o CDI médio for ${pct(x)}% a.a.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `esperado: ${pct(expected)}% a.a. · pesquisa de 13/11/2026`,
      ),
    ).toBeInTheDocument();
    // 2028-01-01 at 12.80% and 2030-01-01 at 13.40%: 321 of 731 days.
    expect(
      screen.getByText("título público para o prazo: 13,06% a.a. · 16/11/2026"),
    ).toBeInTheDocument();
  });

  it("writes the missing curve in words", async () => {
    open(calculatorApiRoutes([cdi]));
    await typeRates("8", "140");

    expect(
      await screen.findByText(
        catalogPtBR["calc.indexerComparison.market.none"],
      ),
    ).toBeInTheDocument();
  });

  it("marks an outdated curve in words", async () => {
    open(calculatorApiRoutes([cdi], [prefixedCurveFixture("2026-11-01")]));
    await typeRates("8", "140");

    expect(
      await screen.findByText(
        catalogPtBR["calc.indexerComparison.stale.curve"],
      ),
    ).toBeInTheDocument();
  });

  it("adds securities up to six and removes only the third and after", async () => {
    open();
    const user = userEvent.setup();
    const add = await screen.findByRole("button", {
      name: catalogPtBR["calc.indexerComparison.add"],
    });
    const remove = () =>
      screen.queryAllByRole("button", { name: /^Remover título/ });

    expect(remove()).toHaveLength(0);
    for (let i = 0; i < 6; i++) await user.click(add);

    expect(
      await screen.findAllByRole("textbox", { name: "Taxa" }),
    ).toHaveLength(6);
    expect(remove()).toHaveLength(4);
    expect(
      screen.queryByRole("button", {
        name: catalogPtBR["calc.indexerComparison.add"],
      }),
    ).toBeNull();
  });

  it("keeps the typed order of the table when the second pays more", async () => {
    open();
    await typeRates("5", "200");

    const table = await screen.findByRole("table");
    await within(table).findByText("Prefixado 5,00% a.a.");
    const names = within(table)
      .getAllByRole("rowheader")
      .map((c) => c.textContent);
    expect(names).toEqual(["Prefixado 5,00% a.a.", "200% do CDI"]);
    expect(document.body.textContent).not.toMatch(/melhor|recomend|vence/i);
  });

  it("offers no index for a currency without one", async () => {
    open(undefined, "USD");
    await rateBoxes();

    // The method and the help texts name the CDI; the indexer select does not offer it.
    for (const group of screen.getAllByRole("group", { name: /^Título/ }))
      expect(within(group).getByRole("combobox")).not.toHaveTextContent(/CDI/);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });
  describe("answer", () => {
    it("leads with the security of the largest final value and its gap to the next", async () => {
      open();
      await typeRates("5", "200");

      const rows = compare({
        amount: 1_000_000,
        days: 731,
        taxBp: 1500,
        redemptionBp: 0,
        securities: [
          { form: "fixed", rate: 0.05, taxed: true },
          { form: "percent", index: "cdi", rate: 2, taxed: true },
        ],
        indexes: new Map([["cdi", cdiData]]),
      });
      const first = rows[0]?.net ?? Number.NaN;
      const second = rows[1]?.net ?? Number.NaN;

      expect(await figure("200% do CDI rende mais")).toBe(
        brl(1_000_000 + second),
      );
      expect(
        screen.getByText(
          `${brl(second - first)} a mais que Prefixado 5,00% a.a. no vencimento.`,
        ),
      ).toBeInTheDocument();
      const net = screen.getByText(
        catalogPtBR["calc.indexerComparison.col.netRate"],
        { selector: "dt" },
      );
      expect(net.parentElement?.querySelector("dd")?.textContent).toMatch(
        /^\d+,\d{2}%$/,
      );
      expect(
        screen.getByText(
          catalogPtBR["calc.indexerComparison.breakEven.title"],
          {
            selector: "dt",
          },
        ),
      ).toBeInTheDocument();
    });

    it("names the missing rate before any is typed", async () => {
      open();

      expect(
        await screen.findByText(
          "Preencha taxa do título 1 e taxa do título 2 para ver o título que rende mais.",
        ),
      ).toBeInTheDocument();
    });

    it("names the rate still missing while only one security has one", async () => {
      open();
      const user = userEvent.setup();
      const [box] = await rateBoxes();
      if (box === undefined) throw new Error("no rate box");
      await user.type(box, "8");

      expect(
        await screen.findByText(
          "Preencha taxa do título 2 para ver o título que rende mais.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(catalogPtBR["calc.indexerComparison.answer.single"]),
      ).toBeNull();
      expect(
        await figure(catalogPtBR["calc.indexerComparison.answer.leadEqual"]),
      ).toBe("—");
    });

    it("states equal final values of two securities", async () => {
      open(undefined, "USD");
      await typeRates("8", "8");

      expect(
        await screen.findByText(
          catalogPtBR["calc.indexerComparison.answer.equal"],
        ),
      ).toBeInTheDocument();
      expect(
        await figure(catalogPtBR["calc.indexerComparison.answer.leadEqual"]),
      ).toMatch(/11\.416,49/);
    });
    it("takes the IOF of a maturity within 30 days", async () => {
      open();
      await typeRates("8", "140");
      const user = userEvent.setup();
      const field = await screen.findByRole("group", { name: /Vencimento/ });
      await user.click(
        within(field).getByRole("spinbutton", { name: /^(day|dia)$/ }),
      );
      await user.keyboard("01122026");

      // Spec 2026-11-19 RT5: 14 days at 8%, IOF 53% of 29.56, then 22.5% of 13.89.
      const table = await screen.findByRole("table");
      expect(within(table).getByText(brl(1880))).toBeInTheDocument();
      expect(within(table).getByText(brl(1076))).toBeInTheDocument();
    });

    it("names the tax rate in a region without rules", async () => {
      open(undefined, "BRL", "US");
      await typeRates("8", "140");

      expect(
        await screen.findByText(
          "Preencha imposto sobre o rendimento para ver o título que rende mais.",
        ),
      ).toBeInTheDocument();
    });
  });
});
