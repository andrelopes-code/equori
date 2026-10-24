import { accountRoutes } from "@/testing/account-api";
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

const subtypes: Record<string, string[]> = {
  fixed_income: ["cdb", "lci"],
  fund: ["multimarket"],
};

export function instrumentsApi(overrides: Record<string, Route> = {}) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/instruments": () => json(200, { items: instrumentFixtures }),
      "GET /api/v1/instrument-subtypes": (req) =>
        json(200, {
          items:
            subtypes[new URL(req.url).searchParams.get("type") ?? ""] ?? [],
        }),
      "GET /api/v1/prices": (req) => {
        const query = new URL(req.url).searchParams;
        const from = query.get("from") ?? "";
        const to = query.get("to") ?? "";
        return json(200, {
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
