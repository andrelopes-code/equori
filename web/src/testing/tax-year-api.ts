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

export const dividendTxID = "d0000000-0000-4000-8000-000000000011";
export const jcpTxID = "d0000000-0000-4000-8000-000000000012";

// S65: a dividend of 10.00 `exempt` with nothing withheld, a JCP of 45.00 `exclusive` with 6.75
// withheld, and a payment of a code the catalogs do not know, without a treatment.
export const incomeEvents = [
  {
    transaction_id: dividendTxID,
    account_id: securityID,
    instrument: "MXRF11",
    date: "2026-10-15",
    income_type: "dividend",
    tax_treatment: "exempt",
    gross: brl(1000),
    withheld: brl(0),
  },
  {
    transaction_id: jcpTxID,
    account_id: petrID,
    instrument: "PETR4",
    date: "2026-10-20",
    income_type: "jcp",
    tax_treatment: "exclusive",
    gross: brl(4500),
    withheld: brl(675),
  },
  {
    transaction_id: usdSaleID,
    account_id: petrID,
    instrument: "PETR4",
    date: "2026-11-02",
    income_type: "royalty",
    tax_treatment: null,
    gross: usd(2000),
    withheld: usd(300),
  },
];

type Route = Parameters<typeof fakeApi>[0][string];

export interface TaxYearRange {
  from: string;
  to: string;
}

// The range the server answers for a year; the calendar year, as the neutral jurisdiction does.
const calendarRange = (year: string): TaxYearRange => ({
  from: `${year}-01-01`,
  to: `${year}-12-31`,
});

// Records the `year` of each request in `years`; `range` is the tax year the server answers.
export function taxYearApi(
  years: string[],
  routes: Record<string, Route> = {},
  results: unknown[] = realizedResults,
  income: unknown[] = incomeEvents,
  range: (year: string) => TaxYearRange = calendarRange,
) {
  return portfolioApi({
    "GET /api/v1/income-events": (req) => {
      const year = new URL(req.url).searchParams.get("year") ?? "";
      years.push(`income ${year}`);
      return json(200, { ...range(year), items: income });
    },
    "GET /api/v1/realized-results": (req) => {
      const year = new URL(req.url).searchParams.get("year") ?? "";
      years.push(year);
      return json(200, { ...range(year), items: results });
    },
    ...routes,
  });
}
