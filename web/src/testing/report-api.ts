import { json } from "@/testing/fake-api";
import { sharedRoutes } from "@/testing/transaction-api";

export const brl = (amount: number) => ({ amount, currency: "BRL" });

// S129 today: assets 2,205.00, liabilities 1,200.00, net 1,005.00; the end of September held
// 150.00 less; every earlier month ends at net 800.00.
export function netWorthAt(date: string) {
  const assets =
    date === "2026-10-17" ? 220500 : date === "2026-09-30" ? 205500 : 200000;
  return {
    assets: brl(assets),
    liabilities: brl(120000),
    net: brl(assets - 120000),
  };
}

export function reportApiRoutes() {
  return {
    ...sharedRoutes,
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
        ],
      }),
    "GET /api/v1/reports/net-worth": (req: Request) =>
      json(200, netWorthAt(new URL(req.url).searchParams.get("date") ?? "")),
  };
}
