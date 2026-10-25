import { fakeApi, json } from "@/testing/fake-api";
import {
  accounts as baseAccounts,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

export const cardID = "c0000000-0000-4000-8000-000000000001";
const usdCardID = "c0000000-0000-4000-8000-000000000002";
export const wiseID = "c0000000-0000-4000-8000-000000000003";
export const eurWalletID = "c0000000-0000-4000-8000-000000000004";
export const travelID = "c0000000-0000-4000-8000-000000000005";
export const taxesID = "c0000000-0000-4000-8000-000000000006";
export const feesID = "c0000000-0000-4000-8000-000000000007";
export const usdWalletID = "c0000000-0000-4000-8000-000000000008";

export const accounts = [
  ...baseAccounts,
  {
    id: cardID,
    name: "Itau Visa",
    class: "liability",
    kind: "credit_card",
    currency: "BRL",
  },
  {
    id: usdCardID,
    name: "Dollar Card",
    class: "liability",
    kind: "credit_card",
    currency: "USD",
  },
  {
    id: wiseID,
    name: "Wise USD",
    class: "asset",
    kind: "wallet",
    currency: "USD",
  },
  {
    id: usdWalletID,
    name: "Cash USD",
    class: "asset",
    kind: "wallet",
    currency: "USD",
  },
  {
    id: eurWalletID,
    name: "Wise EUR",
    class: "asset",
    kind: "wallet",
    currency: "EUR",
  },
  { id: travelID, name: "Travel", class: "expense", currency: "BRL" },
  { id: taxesID, name: "Taxes", class: "expense", currency: "BRL" },
  { id: feesID, name: "Fees", class: "expense", currency: "BRL" },
];

export interface ForeignOptions {
  base?: string;
  chargeBP?: number;
  price?: string;
  noRule?: boolean;
  answer?: () => Response;
}

export function foreignApi(sent: unknown[], options: ForeignOptions = {}) {
  const base = options.base ?? "BRL";
  const posted = async (req: Request) => {
    sent.push(await req.json());
    return (
      options.answer ?? (() => json(201, transactionFixture({ id: txID })))
    )();
  };
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/settings": () => json(200, { base_currency: base }),
    // The accounts of the fixture are in the base currency of the instance.
    "GET /api/v1/accounts": () =>
      json(200, {
        items: accounts.map((a) =>
          a.currency === "BRL" ? { ...a, currency: base } : a,
        ),
      }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
          { code: "EUR", type: "currency", scale: 2, name: "Euro" },
        ],
      }),
    [`GET /api/v1/accounts/${cardID}/cards`]: () =>
      json(200, {
        items: [
          {
            id: "d0000000-0000-4000-8000-000000000001",
            holder: "A",
            last_four: "1234",
            active: true,
            foreign_charge_bp: options.chargeBP ?? 350,
          },
        ],
      }),
    [`GET /api/v1/accounts/${cardID}/statements`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/accounts/${cardID}/statement-placement`]: () =>
      options.noRule === true
        ? json(422, {
            type: "about:blank",
            title: "Unprocessable Entity",
            status: 422,
            code: "no_billing_rule",
          })
        : json(200, {
            reference: "2026-11",
            closing_date: "2026-11-05",
            due_date: "2026-11-12",
          }),
    "GET /api/v1/prices": (req) => {
      const query = new URL(req.url).searchParams;
      return json(200, {
        items:
          options.price === undefined
            ? []
            : [
                {
                  instrument: query.get("instrument"),
                  quote_instrument: query.get("quote_instrument"),
                  date: query.get("to"),
                  value: options.price,
                  source: "ecb",
                },
              ],
      });
    },
    "POST /api/v1/foreign-purchases": posted,
    "POST /api/v1/exchanges": posted,
  });
}
