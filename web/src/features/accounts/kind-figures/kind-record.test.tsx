import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  checkingID,
  loanID,
  money,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { moneyValue } from "@/testing/money-value";
import { renderApp } from "@/testing/render-app";

const propertyID = "a1000000-0000-4000-8000-0000000000f1";
const interestID = "a1000000-0000-4000-8000-0000000000f2";

const property = {
  currency: "BRL",
  opened_on: "2026-01-10",
  yield_mode: "none",
  id: propertyID,
  name: "Car",
  class: "asset",
  kind: "property",
};
const interest = {
  currency: "BRL",
  opened_on: "2026-01-01",
  yield_mode: "none",
  id: interestID,
  name: "Interest",
  class: "expense",
  system_role: "interest",
};
const accounts = [...accountFixtures, property, interest];

const purchase = tx("p", "2026-01-10", [
  [propertyID, 6190000],
  [checkingID, -3402254],
  [loanID, -2787746],
]);
const revaluation = tx("r", "2026-08-31", [[propertyID, -450000]]);
const first = tx("i1", "2026-02-15", [
  [checkingID, -88863],
  [loanID, 36174],
  [interestID, 52689],
]);
const second = tx("i2", "2026-03-15", [
  [checkingID, -88863],
  [loanID, 36858],
  [interestID, 52005],
]);

describe("Property page (K1 to K4, K9)", () => {
  it("shows value, change since purchase and own share, and revalues", async () => {
    await renderApp(`/accounts/${propertyID}`, { fetch: api() });

    expect(
      await screen.findByText(catalogEn["property.own"]),
    ).toBeInTheDocument();
    // 57 400,00 less the loan's 12 000,00 of balanceFixtures.
    expect(screen.getByText(moneyValue(/45,400\.00/))).toBeInTheDocument();
    expect(screen.getByText(moneyValue(/4,500\.00/))).toBeInTheDocument();
    expect(screen.getByText(/Bought for .*61,900\.00/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: catalogEn["property.revalue"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: catalogEn["account.import"] }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tab", {
        name: new RegExp(`^${catalogEn["property.tab.valuations"]}`),
      }),
    ).toBeInTheDocument();
  });
});

describe("Loan page (K5 to K7)", () => {
  it("shows outstanding, repaid share, payoff and interest", async () => {
    await renderApp(`/accounts/${loanID}`, { fetch: api() });

    expect(
      await screen.findByText(catalogEn["loan.outstanding"]),
    ).toBeInTheDocument();
    // −2 787 746 + 36 174 + 36 858 = −2 714 714 owed; 73 032 of 2 787 746 repaid.
    expect(
      await screen.findByText(moneyValue(/27,147\.14/)),
    ).toBeInTheDocument();
    expect(screen.getByText("2.6%")).toBeInTheDocument();
    // Today 2026-10-17: the 15th of 2026-11 to 2029-08 is 2 + 24 + 8 installments.
    expect(screen.getByText("Aug 2029")).toBeInTheDocument();
    expect(screen.getByText(/34 installments of/)).toBeInTheDocument();
    expect(screen.getByText(moneyValue(/1,046\.94/))).toBeInTheDocument();
  });
});

function api() {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/accounts": () => json(200, { items: accounts }),
      [`GET /api/v1/accounts/${propertyID}`]: () => json(200, property),
      [`GET /api/v1/accounts/${propertyID}/balance`]: () =>
        json(200, balance(propertyID, 5740000)),
      [`GET /api/v1/accounts/${loanID}/balance`]: () =>
        json(200, balance(loanID, -2714714)),
      [`GET /api/v1/accounts/${propertyID}/reconciliation`]: () =>
        json(200, { last_reconciled_on: "2026-08-31" }),
      "GET /api/v1/reports/balances": (req) => {
        const id = new URL(req.url).searchParams.get("account_id");
        const from = new URL(req.url).searchParams.get("from") ?? "";
        const opening = id === propertyID ? 6190000 : -2787746;
        const now = id === propertyID ? 5740000 : -2714714;

        return json(200, {
          items: [
            { date: from, balance: money(opening) },
            { date: "2026-10-17", balance: money(now) },
          ],
        });
      },
      "GET /api/v1/transactions": (req) => {
        const id = new URL(req.url).searchParams.get("account_id");
        const all = [second, first, revaluation, purchase];

        return json(200, {
          items: all.filter((t) => t.postings.some((p) => p.account_id === id)),
        });
      },
      "GET /api/v1/schedules": () =>
        json(200, {
          items: [
            {
              id: "s1",
              kind: "transfer",
              account_id: checkingID,
              counterpart_id: loanID,
              description: "Installment",
              ends_on: "2029-08-16",
              pauses: [],
              terms: [
                {
                  effective_from: "2026-02-15",
                  amount: money(88863),
                  recurrence: {
                    frequency: "monthly",
                    interval: 1,
                    day_of_month: 15,
                    start: "2026-02-15",
                    adjustment: "none",
                  },
                },
              ],
            },
          ],
        }),
    }),
  );
}

function balance(id: string, amount: number) {
  return {
    account_id: id,
    date: "2026-10-17",
    basis: "booked",
    balance: money(amount),
  };
}

function tx(id: string, date: string, postings: [string, number][]) {
  return {
    id,
    date,
    description: id,
    balancing_currency: "BRL",
    version: 1,
    origin: "manual",
    tags: [],
    links: [],
    postings: postings.map(([account, amount], i) => ({
      id: `${id}${String(i)}`,
      account_id: account,
      amount: money(amount),
      weight: money(amount),
      status: "cleared",
    })),
  };
}
