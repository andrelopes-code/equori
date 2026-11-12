import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { chooseEntryKind } from "@/testing/entry-kind";
import { problem } from "@/testing/fake-api";
import {
  brokerID,
  cashID,
  investmentApi as api,
  secondCash,
  secondCashID,
  securityID,
  usdBrokerID,
  usdBrokerage,
} from "@/testing/investment-api";
import { moneyValue } from "@/testing/money-value";
import { optionalName } from "@/testing/optional-name";
import { renderApp } from "@/testing/render-app";
import { txID } from "@/testing/transaction-api";

const path = `/transactions/new?kind=trade&account_id=${securityID}`;

async function type(label: string | RegExp, text: string) {
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
  // BC5, BC6: an old holding account id in the route still preselects its brokerage and investment.
  it("preselects the brokerage and the investment of a holding account in the route", async () => {
    await renderApp(path, { fetch: api([]) });
    const brokerage = await screen.findByRole("button", {
      name: new RegExp(catalogEn["trade.brokerage"]),
    });
    expect(brokerage).toHaveTextContent("XP");
    expect(
      await screen.findByRole("combobox", {
        name: catalogEn["trade.investment"],
      }),
    ).toHaveValue("MXRF11");
    expect(
      screen.getByRole("button", { name: catalogEn["entry.kind.trade"] }),
    ).toBeInTheDocument();
  });

  it("offers the trade kind on the new entry", async () => {
    await renderApp("/transactions/new", { fetch: api([]) });
    await chooseEntryKind(userEvent.setup(), catalogEn["entry.kind.trade"]);
    expect(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["trade.brokerage"]),
      }),
    ).toBeInTheDocument();
  });

  it("draws the only cash account as a line with its balance and no select", async () => {
    await renderApp(path, { fetch: api([], { cashBalance: 250000 }) });
    expect(
      await screen.findByText(/Paid from XP cash, balance/),
    ).toHaveTextContent(/2,500\.00/);
    expect(
      screen.queryByRole("button", {
        name: new RegExp(catalogEn["trade.cashAccount"]),
      }),
    ).not.toBeInTheDocument();
  });

  it("draws a select when the brokerage has two cash accounts", async () => {
    await renderApp(path, { fetch: api([], { extraAccounts: [secondCash] }) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["trade.cashAccount"]),
      }),
    );
    const radios = await screen.findAllByRole("radio", { name: /^XP/ });
    expect(radios.map((radio) => radio.getAttribute("value")).sort()).toEqual(
      [cashID, secondCashID].sort(),
    );
  });

  it("shows the missing cash notice for a USD brokerage", async () => {
    const sent: unknown[] = [];
    await renderApp(
      `/transactions/new?kind=trade&brokerage_id=${usdBrokerID}`,
      {
        fetch: api(sent, { extraAccounts: usdBrokerage }),
      },
    );
    expect(
      await screen.findByText("This brokerage has no cash account in BRL."),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(sent).toHaveLength(0);
  });

  it("offers to create the cash account of a brokerage in the base currency", async () => {
    const beta = "b0000000-0000-4000-8000-0000000000b1";
    await renderApp(`/transactions/new?kind=trade&brokerage_id=${beta}`, {
      fetch: api([], {
        extraAccounts: [
          {
            id: beta,
            name: "Beta",
            class: "asset",
            kind: "brokerage",
            currency: "BRL",
          },
          {
            id: "b0000000-0000-4000-8000-0000000000b2",
            name: "Beta MXRF11",
            class: "asset",
            currency: "MXRF11",
            parent_id: beta,
          },
        ],
      }),
    });
    expect(
      await screen.findByText("This brokerage has no cash account in BRL."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: catalogEn["trade.createCash"] }),
    ).toBeInTheDocument();
  });

  it("offers no cash account creation for a brokerage in another currency", async () => {
    await renderApp(
      `/transactions/new?kind=trade&brokerage_id=${usdBrokerID}`,
      {
        fetch: api([], { extraAccounts: usdBrokerage }),
      },
    );
    await screen.findByText("This brokerage has no cash account in BRL.");
    expect(
      screen.queryByRole("button", { name: catalogEn["trade.createCash"] }),
    ).not.toBeInTheDocument();
  });

  it("lists only the investments the brokerage holds for a sale", async () => {
    await renderApp(path, {
      fetch: api([], { held: { quantity: 150, cost: 151240 } }),
    });
    await userEvent.click(
      await screen.findByRole("radio", { name: catalogEn["trade.side.sell"] }),
    );
    await userEvent.click(
      await screen.findByRole("combobox", {
        name: catalogEn["trade.investment"],
      }),
    );
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("MXRF11"),
      expect.stringContaining("PETR4"),
    ]);
  });

  it("shows the quantity the brokerage holds under the investment of a purchase", async () => {
    await renderApp(path, {
      fetch: api([], { held: { quantity: 10, cost: 10000 } }),
    });
    expect(await screen.findByText("Held: 10 MXRF11")).toBeInTheDocument();
  });

  it("offers every investment of the catalog for a purchase", async () => {
    await renderApp(`/transactions/new?kind=trade&brokerage_id=${brokerID}`, {
      fetch: api([]),
    });
    await userEvent.click(
      await screen.findByRole("combobox", {
        name: catalogEn["trade.investment"],
      }),
    );
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);
  });

  it("shows the shortfall with a link to move money and keeps the save enabled", async () => {
    await renderApp(path, { fetch: api([], { cashBalance: 100000 }) });
    await type(catalogEn["trade.quantity"], "150");
    await type(catalogEn["trade.unitPrice"], "10.05");
    expect(
      await screen.findByText(
        /The cash balance is .* short of this purchase\./,
      ),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Move money into XP cash" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining(`to_account_id=${cashID}`),
    );
    expect(link.getAttribute("href")).toContain("kind=transfer");
    expect(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    ).toBeEnabled();
  });

  it("offers only open cash accounts of the same brokerage in the base currency", async () => {
    await renderApp(path, { fetch: api([], { extraAccounts: [secondCash] }) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["trade.cashAccount"]),
      }),
    );
    const radios = await screen.findAllByRole("radio", { name: /^XP/ });
    expect(radios.map((radio) => radio.getAttribute("value"))).not.toContain(
      "b0000000-0000-4000-8000-000000000005",
    );
  });

  // S21, purchase: 150 MXRF11 at 10.05 and 4.90 in fees cost 1,512.40.
  it("records a purchase with the gross and the cash effect of S21", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, { fetch: api(sent) });
    await type(catalogEn["trade.quantity"], "150");
    await type(catalogEn["trade.unitPrice"], "10.05");
    await type(optionalName(catalogEn["trade.fees"]), "490");
    expect(
      await screen.findByText(moneyValue(/1,507\.50/)),
    ).toBeInTheDocument();
    expect(screen.getByText(moneyValue(/1,512\.40/))).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          brokerage_id: brokerID,
          instrument: "MXRF11",
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
    await type(optionalName(catalogEn["trade.fees"]), "210");
    expect(await screen.findByText(moneyValue(/540\.00/))).toBeInTheDocument();
    expect(screen.getByText(moneyValue(/537\.90/))).toBeInTheDocument();
    expect(screen.getByText(/10\.0827/)).toBeInTheDocument();
    expect(screen.getByText(moneyValue(/33\.77/))).toBeInTheDocument();
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

  it("writes the suggested price with the decimal separator of the language", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp(path, { fetch: api([], { price: "9.36" }) });
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: catalogPtBR["trade.unitPrice"] }),
      ).toHaveValue("9,36");
    });
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
