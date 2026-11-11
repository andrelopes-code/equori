import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  candidate,
  expense,
  expenseFixture,
  expenseID,
  inflowFixture,
  otherExpense,
  otherExpenseID,
  reimbursementApi,
  type Sent,
} from "@/testing/reimbursement-api";
import { foodID, transactionFixture, txID } from "@/testing/transaction-api";

const page = `/transactions/${txID}`;
const money = (amount: number) => ({ amount, currency: "BRL" });
const first = expenseFixture(
  expenseID,
  "Pix enviado EVERTON",
  "2026-10-15",
  5000,
);
const second = expenseFixture(
  otherExpenseID,
  "Mercado Pago bakery",
  "2026-10-16",
  5000,
);

describe("reimbursement prompt", () => {
  it("names the expenses that add up to the amount received and confirms them", async () => {
    const sent: Sent[] = [];
    await renderApp(page, {
      fetch: reimbursementApi({
        sent,
        transaction: inflowFixture({}, 10000),
        candidates: [candidate(first, 5000), candidate(second, 5000)],
        suggestion: [expenseID, otherExpenseID],
      }),
    });

    expect(
      await screen.findByText(
        "These expenses add up to exactly the amount received: Pix enviado EVERTON (R$50.00) + Mercado Pago bakery (R$50.00).",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["reimbursement.confirm"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          path: "reimbursement",
          body: {
            expected_version: 1,
            allocations: [
              { original_id: expenseID, amount: money(5000) },
              { original_id: otherExpenseID, amount: money(5000) },
            ],
          },
        },
      ]);
    });
    // The toast is drawn once and announced once.
    expect(
      await screen.findAllByText(catalogEn["reimbursement.done"]),
    ).not.toHaveLength(0);
  });

  it("asks without choosing when no single combination adds up", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({
        candidates: [candidate(expense, 1500), candidate(otherExpense, 4000)],
      }),
    });

    expect(
      await screen.findByText(catalogEn["reimbursement.prompt"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: catalogEn["reimbursement.match"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: catalogEn["reimbursement.confirm"],
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the message of the rule the server refused", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({
        transaction: inflowFixture({}, 10000),
        candidates: [candidate(first, 5000), candidate(second, 5000)],
        suggestion: [expenseID, otherExpenseID],
        reimburse: () =>
          problem(422, "validation_failed", {
            errors: [
              {
                field: "allocations[0].original_id",
                message:
                  "reimbursements would total 5100, above the expense 5000",
              },
            ],
          }),
      }),
    });

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["reimbursement.confirm"],
      }),
    );

    expect(
      await screen.findByText(
        "reimbursements would total 5100, above the expense 5000",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    {
      name: "there are no candidates",
      transaction: inflowFixture(),
      candidates: [],
    },
    {
      name: "the transaction is an outflow",
      transaction: transactionFixture(),
      candidates: [candidate(expense, 1500)],
    },
    {
      name: "the transaction already has a category",
      transaction: inflowFixture({
        postings: [
          {
            id: "p1",
            account_id: "11111111-1111-4111-8111-111111111111",
            amount: money(1500),
            weight: money(1500),
            status: "cleared",
          },
          {
            id: "p2",
            account_id: foodID,
            amount: money(-1500),
            weight: money(-1500),
            status: "cleared",
          },
        ],
      }),
      candidates: [candidate(expense, 1500)],
    },
  ])("asks nothing when $name", async ({ transaction, candidates }) => {
    await renderApp(page, {
      fetch: reimbursementApi({ transaction, candidates }),
    });

    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => {
      expect(
        screen.queryByText(catalogEn["reimbursement.prompt"]),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: catalogEn["reimbursement.match"] }),
    ).not.toBeInTheDocument();
  });
});
