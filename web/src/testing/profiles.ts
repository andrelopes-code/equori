import { accountFixtures, balanceFixtures, money } from "@/testing/account-api";
import { json, type Route } from "@/testing/fake-api";

export interface Profile {
  name: string;
  language: string;
  region: string;
  base: string;
}

export const profiles: readonly Profile[] = [
  { name: "brazil", language: "en", region: "BR", base: "BRL" },
  { name: "neutral", language: "en", region: "NZ", base: "NZD" },
  { name: "foreign base", language: "en", region: "BR", base: "USD" },
];

// The member, settings, accounts and balances of a profile: every account fixture in BRL moves to
// the profile's base currency.
export function profileRoutes(profile: Profile): Record<string, Route> {
  const rebased = accountFixtures.map((a) =>
    a.currency === "BRL" ? { ...a, currency: profile.base } : a,
  );

  return {
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        books_id: 1,
        role: "admin",
        language: profile.language,
        region: profile.region,
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: profile.base }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
          {
            code: "NZD",
            type: "currency",
            scale: 2,
            name: "New Zealand Dollar",
          },
          { code: "PETR4", type: "stock", scale: 0, name: "Petrobras PN" },
        ],
      }),
    "GET /api/v1/accounts": () => json(200, { items: rebased }),
    "GET /api/v1/balances": (req) => {
      const query = new URL(req.url).searchParams;
      return json(200, {
        items: rebased
          .filter((a) => a.class === "asset" || a.class === "liability")
          .map((a) => ({
            account_id: a.id,
            date: query.get("date") ?? "2026-10-17",
            basis: query.get("basis") ?? "booked",
            balance: money(balanceFixtures[a.id] ?? 0, a.currency),
          })),
      });
    },
  };
}
