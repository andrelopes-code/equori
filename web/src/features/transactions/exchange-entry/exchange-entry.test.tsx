import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { MASK } from "@/privacy/mask";
import { chooseEntryKind } from "@/testing/entry-kind";
import { problem } from "@/testing/fake-api";
import {
  eurWalletID,
  feesID,
  foreignApi as api,
  usdWalletID,
  wiseID,
} from "@/testing/foreign-api";
import { optionalName } from "@/testing/optional-name";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { checkingID, savingsID, txID } from "@/testing/transaction-api";

const path = `/transactions/new?kind=exchange&account_id=${checkingID}`;

async function type(label: string | RegExp, text: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: label }),
    text,
  );
}

async function openAccounts(label: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: new RegExp(label) }),
  );
  return await screen.findAllByRole("radio", {
    name: /Itau|Reserva|Wise|Cash|Dollar/,
  });
}

async function chooseAccount(label: string, id: string) {
  const radios = await openAccounts(label);
  const radio = radios.find((r) => r.getAttribute("value") === id);
  if (radio === undefined) throw new Error(`no account ${id}`);
  await userEvent.click(radio);
}

async function pickCategory(label: string | RegExp, text: string) {
  const input = await screen.findByRole("combobox", { name: label });
  await userEvent.click(input);
  await userEvent.type(input, text);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
}

async function fillS17() {
  await chooseAccount(catalogEn["exchange.to"], wiseID);
  await type(catalogEn["exchange.fromAmount"], "548300");
  await type(catalogEn["exchange.toAmount"], "100000");
  await type(optionalName(catalogEn["exchange.fee"]), "3000");
  await pickCategory(optionalName(catalogEn["exchange.feeCategory"]), "Fees");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("currency exchange entry", () => {
  it("opens from the entry picker", async () => {
    await renderApp("/transactions/new", { fetch: api([]) });
    await chooseEntryKind(userEvent.setup(), catalogEn["entry.kind.exchange"]);
    expect(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["exchange.to"]),
      }),
    ).toBeInTheDocument();
  });

  it("offers the accounts of another currency when the origin is in the base currency", async () => {
    await renderApp(path, { fetch: api([]) });
    const radios = await openAccounts(catalogEn["exchange.to"]);
    expect(radios.map((radio) => radio.getAttribute("value")).sort()).toEqual(
      [eurWalletID, usdWalletID, wiseID].sort(),
    );
  });

  it("offers only accounts in the base currency when the origin is in another currency", async () => {
    await renderApp(`/transactions/new?kind=exchange&account_id=${wiseID}`, {
      fetch: api([]),
    });
    const radios = await openAccounts(catalogEn["exchange.to"]);
    expect(radios.map((radio) => radio.getAttribute("value")).sort()).toEqual(
      [checkingID, savingsID].sort(),
    );
  });

  // S17: 1,000.00 USD for 5,483.00 BRL plus a fee of 30.00 BRL debits 5,513.00 BRL.
  it("shows the effective rate in both directions and the total debited of S17", async () => {
    await renderApp(path, { fetch: api([]) });
    await fillS17();
    const result = await screen.findByRole("region", {
      name: catalogEn["exchange.result"],
    });
    expect(within(result).getByText("1 USD = 5.4830 BRL")).toBeInTheDocument();
    expect(
      within(result).getByText("1 BRL = 0.182382 USD"),
    ).toBeInTheDocument();
    expect(within(result).getByText(/5,513\.00/)).toBeInTheDocument();
  });

  it("compares the effective rate with the stored price of the date", async () => {
    await renderApp(path, { fetch: api([], { price: "5.5000" }) });
    await fillS17();
    const result = await screen.findByRole("region", {
      name: catalogEn["exchange.result"],
    });
    expect(await within(result).findByText(/\u22120\.31%/)).toBeInTheDocument();
  });

  it("sends the body of the contract", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, { fetch: api(sent) });
    await fillS17();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          from_account_id: checkingID,
          to_account_id: wiseID,
          date: "2026-10-17",
          from_amount: { amount: 548300, currency: "BRL" },
          to_amount: { amount: 100000, currency: "USD" },
          fee: { amount: 3000, currency: "BRL" },
          fee_category_id: feesID,
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  it("shows the problem of the server on its field", async () => {
    await renderApp(path, {
      fetch: api([], {
        answer: () =>
          problem(422, "validation_failed", {
            errors: [{ field: "to_amount", message: "Amount not accepted." }],
          }),
      }),
    });
    await fillS17();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(await screen.findByText("Amount not accepted.")).toBeInTheDocument();
  });

  it("keeps an incomplete entry out of the API", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(
      await screen.findByText(catalogEn["exchange.required.toAccount"]),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("masks the amounts of the result and keeps the rates", async () => {
    hideAmounts();
    await renderApp(path, { fetch: api([]) });
    await fillS17();
    const result = await screen.findByRole("region", {
      name: catalogEn["exchange.result"],
    });
    await within(result).findAllByText(new RegExp(MASK));
    expectNoAmounts(result, ["5,513.00"]);
    expect(within(result).getByText("1 USD = 5.4830 BRL")).toBeInTheDocument();
  });

  it("holds no Brazilian value in a region with another base currency", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const { container } = await renderApp(path, {
      fetch: api([], { base: "EUR" }),
    });
    await chooseAccount(catalogEn["exchange.to"], wiseID);
    await type(catalogEn["exchange.fromAmount"], "92000");
    await type(catalogEn["exchange.toAmount"], "100000");
    const result = await screen.findByRole("region", {
      name: catalogEn["exchange.result"],
    });
    expect(within(result).getByText("1 USD = 0,9200 EUR")).toBeInTheDocument();
    expect(within(result).getAllByText("€920.00").length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toMatch(/R\$|BRL|IOF/);
  });
});
