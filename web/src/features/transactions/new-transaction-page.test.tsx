import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { chooseAccount } from "@/testing/account-choice";
import { chooseEntryKind } from "@/testing/entry-kind";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  accounts,
  checkingID,
  foodID,
  payeeID,
  savingsID,
  sharedRoutes,
  transactionFixture,
} from "@/testing/transaction-api";

const money = (amount: number) => ({ amount, currency: "BRL" });

function api(
  sent: unknown[],
  answer: () => Response = () => json(201, transactionFixture()),
) {
  return fakeApi({
    ...sharedRoutes,
    "POST /api/v1/transactions": async (req) => {
      sent.push(await req.json());
      return answer();
    },
  });
}

async function pick(label: string, text: string) {
  const input = screen.getByRole("combobox", { name: label });
  await userEvent.click(input);
  await userEvent.type(input, text);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("NewTransactionPage", () => {
  // Owner review 2026-10-22: on a phone the footer stacked its three actions and took a fifth of
  // the screen. It holds one row: Save, and a menu with Discard and Save another.
  it("keeps the phone's footer to Save and a menu of the other actions", async () => {
    await renderApp("/transactions/new", { width: 390, fetch: api([]) });
    const save = await screen.findByRole("button", {
      name: catalogEn["entry.save"],
    });
    const bar = save.closest('[data-ui="action-bar"]');
    if (!(bar instanceof HTMLElement)) throw new Error("no action bar");
    expect(
      within(bar).queryByRole("button", {
        name: catalogEn["entry.saveAnother"],
      }),
    ).toBeNull();
    await userEvent.click(
      within(bar).getByRole("button", { name: catalogEn["entry.moreActions"] }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([catalogEn["entry.discard"], catalogEn["entry.saveAnother"]]);
  });

  it("records an expense and returns to the list", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp("/transactions/new", {
      fetch: api(sent),
    });
    const amount = await screen.findByRole("textbox", {
      name: catalogEn["entry.amount"],
    });
    await userEvent.type(amount, "12000");
    await chooseAccount(catalogEn["entry.payWith"], "Itau");
    await pick(catalogEn["category.label"], "Mercado");
    await pick(catalogEn["facts.payee"], "Padaria");
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["facts.description"] }),
      "Weekly shop",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          date: "2026-10-17",
          description: "Weekly shop",
          payee_id: payeeID,
          postings: [
            { account_id: checkingID, amount: money(-12000) },
            { account_id: foodID, amount: money(12000) },
          ],
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions");
    });
  });

  // A136: a card purchase 3 days before the closing date may land on the next statement; the
  // owner who knows it chooses that one, and the request names it.
  it("records a card purchase on the statement the owner chose", async () => {
    const cardID = "c0000000-0000-4000-8000-000000000001";
    const sent: unknown[] = [];
    await renderApp("/transactions/new", {
      fetch: fakeApi({
        ...sharedRoutes,
        "GET /api/v1/accounts": () =>
          json(200, {
            items: [
              ...accounts,
              {
                id: cardID,
                name: "Nubank Gold",
                class: "liability",
                kind: "credit_card",
                currency: "BRL",
              },
            ],
          }),
        [`GET /api/v1/accounts/${cardID}/statement-placement`]: () =>
          json(200, {
            reference: "2026-11",
            closing_date: "2026-10-20",
            due_date: "2026-10-27",
          }),
        "POST /api/v1/transactions": async (req) => {
          sent.push(await req.json());
          return json(201, transactionFixture());
        },
      }),
    });
    await userEvent.type(
      await screen.findByRole("textbox", { name: catalogEn["entry.amount"] }),
      "713",
    );
    await chooseAccount(catalogEn["entry.payWith"], "Nubank Gold");
    await pick(catalogEn["category.label"], "Mercado");

    await userEvent.click(
      await screen.findByRole("combobox", {
        name: catalogEn["entry.statement"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "December 2026" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          date: "2026-10-17",
          postings: [
            {
              account_id: cardID,
              amount: money(-713),
              statement: "2026-12",
            },
            { account_id: foodID, amount: money(713) },
          ],
        },
      ]);
    });
  });

  it("offers income categories first on an income", async () => {
    await renderApp("/transactions/new", {
      fetch: fakeApi({
        ...sharedRoutes,
        "GET /api/v1/accounts": () =>
          json(200, {
            items: [
              ...accounts,
              {
                id: "99999999-9999-4999-8999-999999999999",
                name: "Salario",
                class: "income",
                currency: "BRL",
              },
            ],
          }),
      }),
    });
    await chooseEntryKind(userEvent.setup(), catalogEn["entry.kind.income"]);

    await userEvent.click(
      await screen.findByRole("combobox", {
        name: catalogEn["category.label"],
      }),
    );

    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveTextContent("Salario");
  });

  it("records a transfer between two accounts", async () => {
    const sent: unknown[] = [];
    await renderApp("/transactions/new", { fetch: api(sent) });
    await chooseEntryKind(userEvent.setup(), catalogEn["entry.kind.transfer"]);
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["entry.amount"] }),
      "50000",
    );
    await chooseAccount(catalogEn["entry.from"], "Itau");
    await chooseAccount(catalogEn["entry.to"], "Reserva");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          date: "2026-10-17",
          postings: [
            { account_id: checkingID, amount: money(-50000) },
            { account_id: savingsID, amount: money(50000) },
          ],
        },
      ]);
    });
  });

  it("names the missing fields before sending anything", async () => {
    const sent: unknown[] = [];
    await renderApp("/transactions/new", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(screen.getByText(catalogEn["entry.fixFields"])).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["entry.required.amount"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["entry.required.account"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["entry.required.category"]),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("puts a refusal of the server under the field it names", async () => {
    const sent: unknown[] = [];
    await renderApp("/transactions/new", {
      fetch: api(sent, () =>
        problem(422, "validation_failed", {
          errors: [
            { field: "postings[1].account_id", message: "Category is closed." },
          ],
        }),
      ),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["entry.amount"],
      }),
      "100",
    );
    await chooseAccount(catalogEn["entry.payWith"], "Itau");
    await pick(catalogEn["category.label"], "Lazer");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(await screen.findByText("Category is closed.")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: catalogEn["category.label"] }),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps what was typed after leaving the form", async () => {
    const { router } = await renderApp("/transactions/new", {
      fetch: api([]),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["facts.description"],
      }),
      "Half done",
    );
    await act(async () => {
      await router.navigate({ to: "/transactions" });
    });
    await act(async () => {
      await router.navigate({ to: "/transactions/new" });
    });
    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["facts.description"],
      }),
    ).toHaveValue("Half done");
  });
});
