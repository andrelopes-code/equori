import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { breakEven } from "@/features/calculators/indexer-comparison/break-even";
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
import { renderWithProviders } from "@/testing/render-app";

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
) {
  return renderWithProviders(
    <IndexerComparison amount={1_000_000} currency={currency} />,
    {
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
            region: "BR",
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

  it("names no winner and keeps the typed order when the second pays more", async () => {
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

    expect(screen.queryByText(/CDI/)).toBeNull();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });
});
