import { fakeApi, json } from "@/testing/fake-api";
import { brl, securityID } from "@/testing/investment-api";
import { petrID, portfolioApi } from "@/testing/portfolio-api";

export const saleID = "d0000000-0000-4000-8000-000000000001";
export const lossID = "d0000000-0000-4000-8000-000000000002";
export const usdSaleID = "d0000000-0000-4000-8000-000000000003";

const usd = (amount: number) => ({ amount, currency: "USD" });

// S64: a result of 33.77 in 2026-10, with a sale at a loss in the same month and a sale in USD
// in the next one, neither with a tax class.
export const realizedResults = [
  {
    transaction_id: saleID,
    account_id: securityID,
    instrument: "MXRF11",
    date: "2026-10-29",
    month: "2026-10",
    quantity: { amount: 100, currency: "MXRF11" },
    cost: brl(100827),
    proceeds: brl(104204),
    result: brl(3377),
    tax_class: "fii",
  },
  {
    transaction_id: lossID,
    account_id: petrID,
    instrument: "PETR4",
    date: "2026-10-30",
    month: "2026-10",
    quantity: { amount: 5, currency: "PETR4" },
    cost: brl(2000),
    proceeds: brl(1500),
    result: brl(-500),
    tax_class: null,
  },
  {
    transaction_id: usdSaleID,
    account_id: petrID,
    instrument: "PETR4",
    date: "2026-11-03",
    month: "2026-11",
    quantity: { amount: 2, currency: "PETR4" },
    cost: usd(4000),
    proceeds: usd(5000),
    result: usd(1000),
    tax_class: null,
  },
];

type Route = Parameters<typeof fakeApi>[0][string];

// Records the `year` of each request in `years`.
export function taxYearApi(
  years: string[],
  routes: Record<string, Route> = {},
  results: unknown[] = realizedResults,
) {
  return portfolioApi({
    "GET /api/v1/realized-results": (req) => {
      years.push(new URL(req.url).searchParams.get("year") ?? "");
      return json(200, { items: results });
    },
    ...routes,
  });
}
