import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
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

// Owner review 2026-10-21, item 16: balance accounts are radio tiles, named by account and kind.
async function chooseAccount(group: string, account: string) {
  await userEvent.click(
    within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", {
      name: new RegExp(`^${account}`),
    }),
  );
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

  it("records a transfer between two accounts", async () => {
    const sent: unknown[] = [];
    await renderApp("/transactions/new", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("radio", {
        name: catalogEn["entry.kind.transfer"],
      }),
    );
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
