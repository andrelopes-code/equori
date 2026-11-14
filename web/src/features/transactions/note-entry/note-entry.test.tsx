import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { problem } from "@/testing/fake-api";
import { brokerID, cashID, investmentApi } from "@/testing/investment-api";
import { optionalName } from "@/testing/optional-name";
import { txID } from "@/testing/transaction-api";
import { renderApp } from "@/testing/render-app";

const path = `/transactions/new?kind=brokerage_note&brokerage_id=${brokerID}`;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("brokerage note entry", () => {
  // S427: two purchases and the costs of the note; each order carries its share of the costs.
  it("sends the orders in order with the costs of the note and shows each share", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: investmentApi(sent) });
    await fillOrder(1, "MXRF11", "100", "30.00");
    await userEvent.click(await addOrder());
    await fillOrder(2, "PETR4", "100", "30.05");
    await userEvent.type(
      screen.getByRole("textbox", {
        name: optionalName(catalogEn["note.fees"]),
      }),
      "251",
    );

    expect(
      await within(order(1)).findByText(/Cost share .*1\.25$/),
    ).toBeVisible();
    expect(within(order(2)).getByText(/Cost share .*1\.26$/)).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toEqual({
      brokerage_id: brokerID,
      cash_account_id: cashID,
      date: "2026-10-17",
      fees: { amount: 251, currency: "BRL" },
      orders: [
        {
          side: "buy",
          instrument: "MXRF11",
          quantity: { amount: 100, currency: "MXRF11" },
          unit_price: "30.00",
        },
        {
          side: "buy",
          instrument: "PETR4",
          quantity: { amount: 100, currency: "PETR4" },
          unit_price: "30.05",
        },
      ],
    });
  });

  it("asks for at least one order before sending", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: investmentApi(sent) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["note.removeOrder"].replace("{n}", "1"),
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );

    expect(
      await screen.findByText(catalogEn["note.required.orders"]),
    ).toBeVisible();
    expect(sent).toHaveLength(0);
  });

  it("puts a refusal of the server under the field of the order it names", async () => {
    const sent: unknown[] = [];
    const refusal = () =>
      problem(422, "validation_failed", {
        errors: [{ field: "orders[1].quantity", message: "Too many units." }],
      });
    await renderApp(path, {
      fetch: investmentApi(sent, { noteAnswer: refusal }),
    });
    await fillOrder(1, "MXRF11", "100", "30.00");
    await userEvent.click(await addOrder());
    await fillOrder(2, "PETR4", "100", "30.05");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );

    expect(await within(order(2)).findByText("Too many units.")).toBeVisible();
    expect(within(order(1)).queryByText("Too many units.")).toBeNull();
  });

  // ADR 027 S3: the form is a phone route; the orders stand one below the other.
  it("stacks the orders in one column on a phone", async () => {
    await renderApp(path, { width: 390, fetch: investmentApi([]) });
    await userEvent.click(await addOrder());

    const orders = screen.getAllByRole("group", { name: /^Order \d$/ });

    expect(orders).toHaveLength(2);
    expect(orders[0]?.parentElement).toBe(orders[1]?.parentElement);
    expect(orders[0]?.nextElementSibling).toBe(orders[1]);
  });

  // The toast of "Save and add another" names the kind recorded; "View" opens the transaction.
  it("announces the recorded entry in a toast that opens it", async () => {
    const { router } = await renderApp(path, { fetch: investmentApi([]) });
    await fillOrder(1, "MXRF11", "100", "30.00");

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.saveAnother"] }),
    );

    expect(
      await screen.findAllByText(catalogEn["note.created"]),
    ).not.toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.view"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });
});

function order(n: number) {
  return screen.getByRole("group", { name: orderName(n) });
}

function orderName(n: number) {
  return catalogEn["note.order"].replace("{n}", String(n));
}

async function addOrder() {
  return screen.findByRole("button", { name: catalogEn["note.addOrder"] });
}

async function fillOrder(
  n: number,
  code: string,
  quantity: string,
  price: string,
) {
  await screen.findByRole("group", { name: orderName(n) });
  const row = within(order(n));
  const instrument = row.getByRole("combobox", {
    name: catalogEn["trade.investment"],
  });
  await userEvent.click(instrument);
  await userEvent.type(instrument, code);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await userEvent.type(
    row.getByRole("textbox", { name: catalogEn["trade.quantity"] }),
    quantity,
  );
  await userEvent.type(
    row.getByRole("textbox", { name: catalogEn["trade.unitPrice"] }),
    price,
  );
}
