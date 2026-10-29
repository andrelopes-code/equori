import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import {
  accounts as investmentAccounts,
  cashID,
  dividendsID,
  securityID,
} from "@/testing/investment-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import {
  checkingID,
  foodID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const buy = transactionFixture({
  postings: [
    {
      id: "p1",
      account_id: cashID,
      amount: brl(-103000),
      weight: brl(-103000),
      status: "cleared",
    },
    {
      id: "p2",
      account_id: securityID,
      amount: { amount: 100, currency: "MXRF11" },
      weight: brl(103000),
      status: "cleared",
    },
  ],
  trade: {
    account_id: securityID,
    cash_account_id: cashID,
    side: "buy",
    quantity: { amount: 100, currency: "MXRF11" },
    unit_price: "10.2500",
    gross: brl(102500),
    fees: brl(500),
    taxes: brl(0),
  },
});

const sell = {
  ...buy,
  trade: {
    ...(buy.trade as object),
    side: "sell",
    cost: brl(90000),
  },
};

const income = transactionFixture({
  postings: [
    {
      id: "p1",
      account_id: cashID,
      amount: brl(8500),
      weight: brl(8500),
      status: "cleared",
    },
    {
      id: "p2",
      account_id: dividendsID,
      amount: brl(-10000),
      weight: brl(-10000),
      status: "cleared",
    },
  ],
  investment_income: {
    account_id: securityID,
    cash_account_id: cashID,
    income_type: "jcp",
    gross: brl(10000),
    withheld: brl(1500),
  },
});

const foreign = transactionFixture({
  balancing_currency: "EUR",
  postings: [
    {
      id: "p1",
      account_id: checkingID,
      amount: { amount: -6100, currency: "EUR" },
      original: { amount: -10000, currency: "JPY" },
      weight: { amount: -6100, currency: "EUR" },
      status: "cleared",
    },
    {
      id: "p2",
      account_id: foodID,
      amount: { amount: 6100, currency: "EUR" },
      weight: { amount: 6100, currency: "EUR" },
      status: "cleared",
    },
  ],
});

function api(tx: Record<string, unknown>, base = "BRL") {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/settings": () => json(200, { base_currency: base }),
    "GET /api/v1/accounts": () => json(200, { items: investmentAccounts }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "EUR", type: "currency", scale: 2, name: "Euro" },
          { code: "JPY", type: "currency", scale: 0, name: "Yen" },
          { code: "MXRF11", type: "reit", scale: 0, name: "MXRF11" },
        ],
      }),
    [`GET /api/v1/transactions/${txID}`]: () => json(200, tx),
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${txID}/categorization`]: () => json(404, {}),
    [`GET /api/v1/transactions/${txID}/attachments`]: () =>
      json(200, { items: [] }),
  });
}

function fact(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt, [data-part='term']" });
  const description = term.nextElementSibling;
  if (!(description instanceof HTMLElement))
    throw new Error(`no value for ${label}`);
  return description;
}

const f = (key: keyof typeof catalogEn) => catalogEn[key];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "en", region: "US" }),
  );
});

describe("transaction facts", () => {
  it("shows the facts of a buy with links to the instrument and the accounts", async () => {
    await renderApp(`/transactions/${txID}`, { fetch: api(buy) });
    await screen.findByText(f("transaction.facts.side"));
    expect(fact(f("transaction.facts.side"))).toHaveTextContent(
      f("trade.side.buy"),
    );
    expect(
      within(fact(f("transaction.facts.instrument"))).getByRole("link"),
    ).toHaveAttribute("href", "/instruments/MXRF11");
    expect(fact(f("transaction.facts.quantity"))).toHaveTextContent("100");
    expect(fact(f("transaction.facts.unitPrice"))).toHaveTextContent("10.2500");
    expect(fact(f("transaction.facts.gross"))).toHaveTextContent("R$1,025.00");
    expect(fact(f("transaction.facts.fees"))).toHaveTextContent("R$5.00");
    expect(fact(f("transaction.facts.taxes"))).toHaveTextContent("R$0.00");
    expect(
      screen.queryByText(f("transaction.facts.cost")),
    ).not.toBeInTheDocument();
    expect(
      within(fact(f("transaction.facts.securityAccount"))).getByRole("link"),
    ).toHaveAttribute("href", `/accounts/${securityID}`);
    expect(
      within(fact(f("transaction.facts.cashAccount"))).getByRole("link"),
    ).toHaveAttribute("href", `/accounts/${cashID}`);
  });

  it("shows the cost at average price of a sell", async () => {
    await renderApp(`/transactions/${txID}`, { fetch: api(sell) });
    await screen.findByText(f("transaction.facts.side"));
    expect(fact(f("transaction.facts.side"))).toHaveTextContent(
      f("trade.side.sell"),
    );
    expect(fact(f("transaction.facts.cost"))).toHaveTextContent("R$900.00");
  });

  it("shows the income with its type, withheld and net amounts", async () => {
    await renderApp(`/transactions/${txID}`, { fetch: api(income) });
    await screen.findByText(f("transaction.facts.incomeType"));
    expect(fact(f("transaction.facts.incomeType"))).toHaveTextContent(
      f("income.type.jcp"),
    );
    expect(fact(f("transaction.facts.gross"))).toHaveTextContent("R$100.00");
    expect(fact(f("transaction.facts.withheld"))).toHaveTextContent("R$15.00");
    expect(fact(f("transaction.facts.net"))).toHaveTextContent("R$85.00");
    expect(
      within(fact(f("transaction.facts.securityAccount"))).getByRole("link"),
    ).toHaveAttribute("href", `/accounts/${securityID}`);
    expect(
      within(fact(f("transaction.facts.cashAccount"))).getByRole("link"),
    ).toHaveAttribute("href", `/accounts/${cashID}`);
  });

  it("falls back to the raw code of an income type without a label", async () => {
    const odd = {
      ...income,
      investment_income: {
        ...(income.investment_income as object),
        income_type: "rent_share",
      },
    };
    await renderApp(`/transactions/${txID}`, { fetch: api(odd) });
    await screen.findByText(f("transaction.facts.incomeType"));
    expect(fact(f("transaction.facts.incomeType"))).toHaveTextContent(
      "rent_share",
    );
  });

  // The history section names the current version; a bare number among the facts said nothing.
  it("leaves the version to the history section", async () => {
    await renderApp(`/transactions/${txID}`, {
      fetch: api(transactionFixture()),
    });

    await screen.findByText(f("facts.origin"));

    expect(screen.queryByText("Version")).not.toBeInTheDocument();
  });

  it("adds no section to a plain transaction", async () => {
    await renderApp(`/transactions/${txID}`, {
      fetch: api(transactionFixture()),
    });
    await screen.findByText(f("facts.origin"));
    expect(
      screen.queryByText(f("transaction.facts.side")),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(f("transaction.facts.incomeType")),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Original amount/)).not.toBeInTheDocument();
  });

  it("masks the amounts of the facts and keeps the quantity and the price", async () => {
    hideAmounts();
    const { container } = await renderApp(`/transactions/${txID}`, {
      fetch: api(sell),
    });
    await screen.findByText(f("transaction.facts.side"));
    expectNoAmounts(container, ["1,025.00", "900.00"]);
    expect(fact(f("transaction.facts.quantity"))).toHaveTextContent("100");
    expect(fact(f("transaction.facts.unitPrice"))).toHaveTextContent("10.2500");
  });

  it("shows the original amount and the implied rate of a posting in a region with another currency", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const { container } = await renderApp(`/transactions/${txID}`, {
      fetch: api(foreign, "EUR"),
    });
    await screen.findByText(f("postings.caption"));
    await waitFor(() => {
      expect(screen.getByText("1 JPY = 0,0061 EUR")).toBeInTheDocument();
    });
    expect(screen.getByText(/Original amount:/)).toHaveTextContent(
      "Original amount: \u2212JP¥10,000",
    );
    expect(container.innerHTML).not.toMatch(/R\$|BRL|IOF/);
  });

  it("masks the original amount and keeps the implied rate", async () => {
    hideAmounts();
    const { container } = await renderApp(`/transactions/${txID}`, {
      fetch: api(foreign, "EUR"),
    });
    await screen.findByText(f("postings.caption"));
    expect(await screen.findByText("1 JPY = 0.0061 EUR")).toBeInTheDocument();
    expectNoAmounts(
      container,
      ["100", "61.00"].map((s) => s),
    );
  });
});
