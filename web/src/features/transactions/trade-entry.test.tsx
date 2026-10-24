import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  accounts as baseAccounts,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const brokerID = "b0000000-0000-4000-8000-000000000001";
const cashID = "b0000000-0000-4000-8000-000000000002";
const securityID = "b0000000-0000-4000-8000-000000000003";
const otherSecurityID = "b0000000-0000-4000-8000-000000000004";
const closedCashID = "b0000000-0000-4000-8000-000000000005";
const taxID = "b0000000-0000-4000-8000-000000000006";

const accounts = [
  ...baseAccounts,
  {
    id: brokerID,
    name: "XP",
    class: "asset",
    kind: "brokerage",
    currency: "BRL",
  },
  {
    id: cashID,
    name: "XP cash",
    class: "asset",
    currency: "BRL",
    parent_id: brokerID,
  },
  {
    id: closedCashID,
    name: "XP old cash",
    class: "asset",
    currency: "BRL",
    parent_id: brokerID,
    closed_on: "2026-01-01",
  },
  {
    id: securityID,
    name: "XP MXRF11",
    class: "asset",
    currency: "MXRF11",
    parent_id: brokerID,
  },
  {
    id: otherSecurityID,
    name: "XP PETR4",
    class: "asset",
    currency: "PETR4",
    parent_id: brokerID,
  },
  { id: taxID, name: "Income tax", class: "expense", currency: "BRL" },
];

const brl = (amount: number) => ({ amount, currency: "BRL" });

function api(
  sent: unknown[],
  options: {
    price?: string;
    held?: { quantity: number; cost: number };
    answer?: () => Response;
  } = {},
) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "MXRF11", type: "reit", scale: 0, name: "MXRF11" },
          { code: "PETR4", type: "stock", scale: 0, name: "PETR4" },
        ],
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
                  date: query.get("from"),
                  value: options.price,
                  source: "b3_cotahist",
                },
              ],
      });
    },
    "GET /api/v1/positions": () =>
      json(200, {
        items:
          options.held === undefined
            ? []
            : [
                {
                  account_id: securityID,
                  instrument: "MXRF11",
                  quantity: {
                    amount: options.held.quantity,
                    currency: "MXRF11",
                  },
                  cost_basis: brl(options.held.cost),
                  average_cost: "10.0827",
                },
              ],
      }),
    "POST /api/v1/trades": async (req) => {
      sent.push(await req.json());
      return (
        options.answer ?? (() => json(201, transactionFixture({ id: txID })))
      )();
    },
  });
}

const path = `/transactions/new?kind=trade&account_id=${securityID}`;

async function type(label: string, text: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: label }),
    text,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("trade entry", () => {
  it("opens from the security account with the account chosen", async () => {
    await renderApp(path, { fetch: api([]) });
    const trigger = await screen.findByRole("button", {
      name: new RegExp(catalogEn["trade.securityAccount"]),
    });
    expect(trigger).toHaveTextContent("XP MXRF11");
    expect(
      screen.getByRole("radio", { name: catalogEn["entry.kind.trade"] }),
    ).toBeChecked();
  });

  it("offers the trade kind on the new entry", async () => {
    await renderApp("/transactions/new", { fetch: api([]) });
    await userEvent.click(
      await screen.findByRole("radio", { name: catalogEn["entry.kind.trade"] }),
    );
    expect(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["trade.securityAccount"]),
      }),
    ).toBeInTheDocument();
  });

  it("offers only open cash accounts of the same brokerage in the base currency", async () => {
    await renderApp(path, { fetch: api([]) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["trade.cashAccount"]),
      }),
    );
    const radios = await screen.findAllByRole("radio", {
      name: /^XP|^Itau|^Reserva/,
    });
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([
      cashID,
    ]);
  });

  // S21, purchase: 150 MXRF11 at 10.05 and 4.90 in fees cost 1,512.40.
  it("records a purchase with the gross and the cash effect of S21", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, { fetch: api(sent) });
    await type(catalogEn["trade.quantity"], "150");
    await type(catalogEn["trade.unitPrice"], "10.05");
    await type(catalogEn["trade.fees"], "490");
    expect(await screen.findByText(/1,507\.50/)).toBeInTheDocument();
    expect(screen.getByText(/1,512\.40/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          account_id: securityID,
          cash_account_id: cashID,
          side: "buy",
          date: "2026-10-17",
          quantity: { amount: 150, currency: "MXRF11" },
          unit_price: "10.05",
          fees: { amount: 490, currency: "BRL" },
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  it("suggests the stored price of the date and keeps an override", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent, { price: "9.36" }) });
    const price = await screen.findByRole("textbox", {
      name: catalogEn["trade.unitPrice"],
    });
    await waitFor(() => {
      expect(price).toHaveValue("9.36");
    });
    await userEvent.clear(price);
    await userEvent.type(price, "9.40");
    await type(catalogEn["trade.quantity"], "10");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({ unit_price: "9.40" });
  });

  // S21, sale: 50 of 150 held at cost 1,512.40 sold at 10.80 with 2.10 in fees leave a result of 33.77.
  it("shows the position, average cost and estimated result of a sale", async () => {
    const sent: unknown[] = [];
    await renderApp(path, {
      fetch: api(sent, { held: { quantity: 150, cost: 151240 } }),
    });
    await userEvent.click(
      await screen.findByRole("radio", { name: catalogEn["trade.side.sell"] }),
    );
    await type(catalogEn["trade.quantity"], "50");
    await type(catalogEn["trade.unitPrice"], "10.80");
    await type(catalogEn["trade.fees"], "210");
    expect(await screen.findByText(/540\.00/)).toBeInTheDocument();
    expect(screen.getByText(/537\.90/)).toBeInTheDocument();
    expect(screen.getByText(/10\.0827/)).toBeInTheDocument();
    expect(screen.getByText(/33\.77/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({ side: "sell" });
  });

  it("refuses a sale above the position of the date", async () => {
    const sent: unknown[] = [];
    await renderApp(path, {
      fetch: api(sent, { held: { quantity: 100, cost: 100827 } }),
    });
    await userEvent.click(
      await screen.findByRole("radio", { name: catalogEn["trade.side.sell"] }),
    );
    await type(catalogEn["trade.quantity"], "101");
    await type(catalogEn["trade.unitPrice"], "10.80");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(
      await screen.findByText("The position on this date is 100."),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("shows the problem the server returns on its field", async () => {
    await renderApp(path, {
      fetch: api([], {
        answer: () =>
          problem(422, "validation_failed", {
            errors: [
              { field: "quantity", message: "Quantity exceeds holding." },
            ],
          }),
      }),
    });
    await type(catalogEn["trade.quantity"], "10");
    await type(catalogEn["trade.unitPrice"], "10");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(
      await screen.findByText("Quantity exceeds holding."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: catalogEn["trade.quantity"] }),
    ).toHaveAttribute("aria-invalid", "true");
  });
});
