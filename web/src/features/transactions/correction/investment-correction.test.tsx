import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import {
  brl,
  brokerID,
  cashID,
  dividendsID,
  investmentRoutes,
  securityID,
} from "@/testing/investment-api";
import type { InvestmentOptions } from "@/testing/investment-api";
import { renderApp } from "@/testing/render-app";
import { transactionFixture, txID } from "@/testing/transaction-api";

const path = `/transactions/${txID}/correct`;
const units = (amount: number) => ({ amount, currency: "MXRF11" });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// A227 IC9 to IC11, S415 and S416.
describe("investment correction", () => {
  it("corrects the price of a purchase in the trade form", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, {
      fetch: api(sent, purchase(), {}),
    });
    const price = await screen.findByRole("textbox", {
      name: catalogEn["trade.unitPrice"],
    });
    expect(price).toHaveValue("10.05");
    expect(
      screen.queryByRole("button", { name: catalogEn["entry.kind.trade"] }),
    ).not.toBeInTheDocument();

    await userEvent.clear(price);
    await userEvent.type(price, "10.00");
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["correct.reason"] }),
      "price",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["correct.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          expected_version: 3,
          reason: "price",
          trade: {
            brokerage_id: brokerID,
            instrument: "MXRF11",
            cash_account_id: cashID,
            side: "buy",
            date: "2026-10-05",
            quantity: units(150),
            unit_price: "10.00",
            fees: brl(490),
            description: "Weekly shop",
          },
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  // IC10: the position of the sale's date already lost the 50 units it sold.
  it("lets a sale grow to the position held before it", async () => {
    const sent: unknown[] = [];
    await renderApp(path, {
      fetch: api(sent, sale(), { held: { quantity: 100, cost: 100827 } }),
    });
    expect(await screen.findByText("150 MXRF11")).toBeInTheDocument();

    const quantity = screen.getByRole("textbox", {
      name: catalogEn["trade.quantity"],
    });
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "150");
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["correct.reason"] }),
      "quantity",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["correct.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        expect.objectContaining({
          trade: expect.objectContaining({
            side: "sell",
            quantity: units(150),
          }) as unknown,
        }),
      ]);
    });
  });

  it("asks for a reason before sending a trade", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent, purchase(), {}) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["correct.save"] }),
    );

    expect(
      await screen.findByText(catalogEn["correct.reasonRequired"]),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("corrects the gross amount of an income in the income form", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent, dividend(), {}) });
    const gross = await screen.findByRole("textbox", {
      name: new RegExp(catalogEn["income.gross"]),
    });
    expect(gross).toHaveValue("12.00");

    await userEvent.clear(gross);
    await userEvent.type(gross, "1500");
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["correct.reason"] }),
      "gross",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["correct.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          expected_version: 3,
          reason: "gross",
          income: {
            brokerage_id: brokerID,
            instrument: "MXRF11",
            cash_account_id: cashID,
            income_type: "dividend",
            date: "2026-10-26",
            gross: brl(1500),
            withheld: brl(0),
            category_id: dividendsID,
            description: "Weekly shop",
          },
        },
      ]);
    });
  });
});

function api(
  sent: unknown[],
  stored: Record<string, unknown>,
  options: InvestmentOptions,
) {
  const answer = () => json(200, stored);

  return fakeApi({
    ...investmentRoutes([], options),
    [`GET /api/v1/transactions/${txID}`]: answer,
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${txID}/attachments`]: () =>
      json(200, { items: [] }),
    [`PUT /api/v1/trades/${txID}`]: async (req) => {
      sent.push(await req.json());
      return answer();
    },
    [`PUT /api/v1/investment-income/${txID}`]: async (req) => {
      sent.push(await req.json());
      return answer();
    },
  });
}

function posting(id: string, account: string, amount: unknown, weight: number) {
  return {
    id,
    account_id: account,
    amount,
    weight: brl(weight),
    status: "cleared",
  };
}

function purchase() {
  return transactionFixture({
    date: "2026-10-05",
    payee_id: undefined,
    tags: [],
    postings: [
      posting("p1", cashID, brl(-151240), -151240),
      posting("p2", securityID, units(150), 151240),
    ],
    trade: {
      account_id: securityID,
      cash_account_id: cashID,
      side: "buy",
      quantity: units(150),
      unit_price: "10.05",
      gross: brl(150750),
      fees: brl(490),
      taxes: brl(0),
    },
  });
}

function sale() {
  return transactionFixture({
    date: "2026-10-20",
    payee_id: undefined,
    tags: [],
    postings: [
      posting("p1", cashID, brl(53790), 53790),
      posting("p2", securityID, units(-50), -50413),
    ],
    trade: {
      account_id: securityID,
      cash_account_id: cashID,
      side: "sell",
      quantity: units(50),
      unit_price: "10.80",
      gross: brl(54000),
      fees: brl(210),
      taxes: brl(0),
      cost: brl(50413),
    },
  });
}

function dividend() {
  return transactionFixture({
    date: "2026-10-26",
    payee_id: undefined,
    tags: [],
    postings: [
      posting("p1", cashID, brl(1200), 1200),
      posting("p2", dividendsID, brl(-1200), -1200),
    ],
    investment_income: {
      account_id: securityID,
      cash_account_id: cashID,
      income_type: "dividend",
      gross: brl(1200),
      withheld: brl(0),
    },
  });
}
