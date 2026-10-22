import { screen, waitFor, within } from "@testing-library/react";
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
import { leisureID, transactionFixture, txID } from "@/testing/transaction-api";

const page = `/transactions/${txID}`;
const money = (amount: number) => ({ amount, currency: "BRL" });
const candidates = [candidate(expense, 1500), candidate(otherExpense, 4000)];

async function openDialog() {
  await userEvent.click(
    await screen.findByRole("button", { name: catalogEn["detail.reimburse"] }),
  );
  return screen.findByRole("dialog");
}

const box = (dialog: HTMLElement, name: RegExp) =>
  within(dialog).findByRole("checkbox", { name });

const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", {
    name: catalogEn["reimbursement.submit"],
  });

describe("reimbursement dialog", () => {
  it("starts with nothing checked and fills what is left when a row is checked", async () => {
    const sent: Sent[] = [];
    await renderApp(page, {
      fetch: reimbursementApi({
        sent,
        transaction: inflowFixture({}, 10000),
        candidates: [
          candidate(
            expenseFixture(
              expenseID,
              "Pix enviado EVERTON",
              "2026-10-15",
              8000,
            ),
            8000,
          ),
          candidate(
            expenseFixture(
              otherExpenseID,
              "Mercado Pago bakery",
              "2026-10-16",
              6000,
            ),
            6000,
          ),
        ],
      }),
    });

    const dialog = await openDialog();
    const first = await box(dialog, /Pix enviado EVERTON/);
    const second = await box(dialog, /Mercado Pago bakery/);
    expect(first).not.toBeChecked();
    expect(second).not.toBeChecked();
    expect(submit(dialog)).toBeDisabled();
    await userEvent.click(first);
    await userEvent.click(second);

    expect(
      within(dialog).getByText("Allocated R$100.00 of R$100.00 · Left R$0.00"),
    ).toBeInTheDocument();
    await userEvent.click(submit(dialog));
    await waitFor(() => {
      expect(sent[0]?.body).toEqual({
        expected_version: 1,
        allocations: [
          { original_id: expenseID, amount: money(8000) },
          { original_id: otherExpenseID, amount: money(2000) },
        ],
      });
    });
  });

  it("sends the category the reader names on every checked expense", async () => {
    const sent: Sent[] = [];
    await renderApp(page, { fetch: reimbursementApi({ sent, candidates }) });

    const dialog = await openDialog();
    await userEvent.click(await box(dialog, /Pix enviado EVERTON/));
    await userEvent.type(
      within(dialog).getByRole("combobox", {
        name: catalogEn["reimbursement.category"],
      }),
      "Lazer",
    );
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(submit(dialog));

    await waitFor(() => {
      expect(sent[0]?.body).toEqual({
        expected_version: 1,
        allocations: [
          {
            original_id: expenseID,
            amount: money(1500),
            category_id: leisureID,
          },
        ],
      });
    });
  });

  it("opens the expenses the transaction already repays checked and clears them", async () => {
    const sent: Sent[] = [];
    await renderApp(page, {
      fetch: reimbursementApi({
        sent,
        transaction: inflowFixture({ version: 2 }),
        candidates: [
          candidate(expense, 1500, 1000),
          candidate(otherExpense, 4000),
        ],
      }),
    });

    const dialog = await openDialog();
    expect(await box(dialog, /Pix enviado EVERTON/)).toBeChecked();
    expect(await box(dialog, /Mercado Pago bakery/)).not.toBeChecked();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["reimbursement.clear"],
      }),
    );

    await waitFor(() => {
      expect(sent[0]?.body).toEqual({ expected_version: 2, allocations: [] });
    });
  });

  it("says so when no expense can be reimbursed", async () => {
    await renderApp(page, { fetch: reimbursementApi({ candidates: [] }) });

    const dialog = await openDialog();

    expect(
      await within(dialog).findByText(catalogEn["reimbursement.empty"]),
    ).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
  });

  it("shows the problem of a changed transaction", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({
        candidates,
        reimburse: () => problem(409, "version_conflict"),
      }),
    });

    const dialog = await openDialog();
    await userEvent.click(await box(dialog, /Pix enviado EVERTON/));
    await userEvent.click(submit(dialog));

    expect(
      await within(dialog).findByText(catalogEn["problem.version_conflict"]),
    ).toBeInTheDocument();
  });

  it("offers the action to an inflow only", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({ transaction: transactionFixture() }),
    });

    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.queryByRole("button", { name: catalogEn["detail.reimburse"] }),
    ).not.toBeInTheDocument();
  });
});
