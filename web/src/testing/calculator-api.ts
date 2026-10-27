import { json } from "@/testing/fake-api";
import { sharedRoutes } from "@/testing/transaction-api";

interface IndexFixture {
  id: string;
  period: "day" | "month";
  rates: { date: string; rate: string }[];
}

// 0.04% on each weekday from 2025-10-01 to 2026-10-16: more than a year of a daily index before
// the fake today, 2026-10-17.
export function cdiFixture(): IndexFixture {
  const rates: { date: string; rate: string }[] = [];
  for (
    let d = new Date(Date.UTC(2025, 9, 1));
    d <= new Date(Date.UTC(2026, 9, 16));
    d = new Date(d.getTime() + 86400000)
  ) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6)
      rates.push({ date: d.toISOString().slice(0, 10), rate: "0.0004" });
  }
  return { id: "cdi", period: "day", rates };
}

// IPCA of 2020, SGS series 433, as fractions.
export function ipcaFixture(): IndexFixture {
  const percents = [
    "0.21",
    "0.25",
    "0.07",
    "-0.31",
    "-0.38",
    "0.26",
    "0.36",
    "0.24",
    "0.64",
    "0.86",
    "0.89",
    "1.35",
  ];
  return {
    id: "ipca",
    period: "month",
    rates: percents.map((p, i) => ({
      date: `2020-${String(i + 1).padStart(2, "0")}-01`,
      rate: String(Number(p) / 100),
    })),
  };
}

// The routes a calculator reads, with the given indexes stored.
export function calculatorApiRoutes(
  indexes: IndexFixture[] = [],
): Record<string, (req: Request) => Response> {
  return {
    ...sharedRoutes,
    "GET /api/v1/indexes": () =>
      json(200, {
        items: indexes.map((x) => ({
          id: x.id,
          period: x.period,
          first: x.rates[0]?.date,
          last: x.rates.at(-1)?.date,
        })),
      }),
    ...Object.fromEntries(
      indexes.map((x) => [
        `GET /api/v1/indexes/${x.id}/rates`,
        (req: Request) => {
          const q = new URL(req.url).searchParams;
          const from = q.get("from") ?? "";
          const to = q.get("to") ?? "";
          return json(200, {
            items: x.rates.filter((r) => r.date >= from && r.date <= to),
          });
        },
      ]),
    ),
  };
}
