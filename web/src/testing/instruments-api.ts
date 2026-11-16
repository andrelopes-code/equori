import { accountRoutes, money, stockID } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";

type Route = (req: Request) => Response | Promise<Response>;

export const instrumentFixtures = [
  { code: "BRL", type: "currency", scale: 2, name: "Real" },
  { code: "USD", type: "currency", scale: 2, name: "Dollar" },
  {
    code: "PETR4",
    type: "stock",
    scale: 0,
    name: "Petrobras PN",
    quote_currency: "BRL",
    exchange: "B3SA",
  },
  {
    code: "VALE3",
    type: "stock",
    scale: 0,
    name: "Vale ON",
    quote_currency: "BRL",
    exchange: "B3SA",
  },
  {
    code: "CDB1",
    type: "fixed_income",
    scale: 2,
    name: "CDB Bank One",
    quote_currency: "BRL",
    subtype: "cdb",
  },
];

export function price(
  instrument: string,
  date: string,
  value: string,
  source: string,
  quote = "BRL",
) {
  return { instrument, quote_instrument: quote, date, value, source };
}

export const priceFixtures = [
  price("PETR4", "2026-10-14", "38.10", "b3_cotahist"),
  price("PETR4", "2026-10-16", "38.45", "b3_cotahist"),
  price("VALE3", "2026-10-10", "61.20", "manual"),
  price("USD", "2026-10-16", "5.4830", "bcb_ptax"),
];

const point = (date: string, value: string) => ({ date, value });

const noReferences = {
  week: null,
  month: null,
  quarter: null,
  year: null,
  year_to_date: null,
};

// The references count back from the date of the last price (IQ4). VALE3 holds a one-year-old
// history only, so its other windows have no reference price.
export const quoteFixtures = [
  {
    instrument: "PETR4",
    quote_instrument: "BRL",
    last: point("2026-10-16", "38.45"),
    // IQ13: 31 prices, 3 days apart, rising to the last one.
    trend: Array.from({ length: 31 }, (_, k) => String(30 + k * 0.28)),
    references: {
      week: point("2026-10-09", "36"),
      month: point("2026-09-16", "40"),
      quarter: null,
      year: point("2025-10-16", "30.76"),
      year_to_date: point("2025-12-30", "35"),
    },
  },
  {
    instrument: "VALE3",
    quote_instrument: "BRL",
    last: point("2026-10-10", "61.20"),
    trend: [],
    references: { ...noReferences, year: point("2025-10-10", "51") },
  },
  {
    instrument: "CDB1",
    quote_instrument: "BRL",
    last: null,
    trend: [],
    references: noReferences,
  },
  {
    instrument: "USD",
    quote_instrument: "BRL",
    last: point("2026-10-16", "5.4830"),
    trend: [],
    references: { ...noReferences, week: point("2026-10-09", "5.3") },
  },
];

// S123: a CDB of 1,000.00 at 110% of the CDI issued on 2026-01-02.
export const cdbTerms = {
  issued_on: "2026-01-02",
  matures_on: "2027-01-02",
  index_id: "cdi",
  percent_of_index_bp: 11000,
  spread_bp: 0,
  day_count: "bus252",
  face_value: 100000,
  daily_liquidity: false,
};

// What the API returns for the terms above: the output always carries the expanded payments.
export const cdbTermsOutput = { ...cdbTerms, payments: [] };

export const positionFixtures = [
  {
    account_id: stockID,
    instrument: "PETR4",
    quantity: money(100, "PETR4"),
    cost_basis: money(350000),
    average_cost: "35.00",
    market_value: money(384500),
  },
  {
    account_id: stockID,
    instrument: "VALE3",
    quantity: money(10, "VALE3"),
    cost_basis: money(60000),
  },
];

const subtypes: Record<string, string[]> = {
  fixed_income: ["cdb", "lci"],
  fund: ["multimarket"],
};

export function instrumentsApi(overrides: Record<string, Route> = {}) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/instruments": () => json(200, { items: instrumentFixtures }),
      ...Object.fromEntries(
        instrumentFixtures.map((i) => [
          `GET /api/v1/instruments/${i.code}`,
          () => json(200, i),
        ]),
      ),
      "GET /api/v1/instruments/CDB1/terms": () => json(200, cdbTermsOutput),
      "GET /api/v1/indexes": () =>
        json(200, {
          items: [
            {
              id: "cdi",
              expected: false,
              period: "day",
              first: "2020-01-01",
              last: "2026-10-16",
            },
            {
              id: "ipca",
              expected: true,
              period: "month",
              first: "2020-01-01",
              last: "2026-09-01",
            },
          ],
        }),
      "GET /api/v1/calendars": () =>
        json(200, {
          default: "br_banking",
          items: [
            { id: "br_banking", weekend: ["saturday", "sunday"] },
            { id: "weekend", weekend: ["saturday", "sunday"] },
          ],
        }),
      "GET /api/v1/positions": () => json(200, { items: positionFixtures }),
      "GET /api/v1/instrument-subtypes": (req) =>
        json(200, {
          items:
            subtypes[new URL(req.url).searchParams.get("type") ?? ""] ?? [],
        }),
      "GET /api/v1/instrument-quotes": () =>
        json(200, { items: quoteFixtures }),
      "GET /api/v1/prices": (req) => {
        const query = new URL(req.url).searchParams;
        const from = query.get("from") ?? "";
        const to = query.get("to") ?? "";
        return json(200, {
          interval: "day",
          items: priceFixtures.filter(
            (p) =>
              p.instrument === query.get("instrument") &&
              p.date >= from &&
              p.date <= to,
          ),
        });
      },
      ...overrides,
    }),
  );
}
