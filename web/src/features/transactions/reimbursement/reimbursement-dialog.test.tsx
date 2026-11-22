import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
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
      within(dialog).getByRole("meter", {
        name: "Distributed R$100.00 of R$100.00",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("2 expenses checked")).toBeInTheDocument();
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
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["reimbursement.categoryKeep"],
      }),
    );
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
      await within(dialog).findByText(catalogEn["reimbursement.emptyTitle"]),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(catalogEn["reimbursement.empty"]),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: catalogEn["reimbursement.submit"],
      }),
    ).not.toBeInTheDocument();
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

  it("asks the share in the row of a checked expense only", async () => {
    await renderApp(page, { fetch: reimbursementApi({ candidates }) });

    const dialog = await openDialog();
    await userEvent.click(await box(dialog, /Pix enviado EVERTON/));

    expect(
      within(dialog).getByRole("textbox", {
        name: "Amount for Pix enviado EVERTON",
      }),
    ).toHaveValue("15.00");
    expect(
      within(dialog).queryByRole("textbox", {
        name: "Amount for Mercado Pago bakery",
      }),
    ).not.toBeInTheDocument();
  });

  it("draws the amount received while the expenses load", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({
        candidatesResponse: () => new Promise<Response>(() => undefined),
      }),
    });

    const dialog = await openDialog();

    expect(
      within(dialog).getByText(catalogEn["reimbursement.status.loading"]),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("R$15.00")).toBeInTheDocument();
  });

  it("names the inflow in the header", async () => {
    await renderApp(page, { fetch: reimbursementApi({ candidates }) });

    const dialog = await openDialog();

    expect(
      within(dialog).getByText("Transferência Recebida · 10/10/2026"),
    ).toBeInTheDocument();
  });

  it("names the checked expense left with no amount and keeps the submit off", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({
        transaction: inflowFixture({}, 10000),
        candidates: [
          candidate(
            expenseFixture(
              expenseID,
              "Pix enviado EVERTON",
              "2026-10-15",
              12000,
            ),
            12000,
          ),
          candidate(otherExpense, 4000),
        ],
      }),
    });

    const dialog = await openDialog();
    await userEvent.click(await box(dialog, /Pix enviado EVERTON/));
    await userEvent.click(await box(dialog, /Mercado Pago bakery/));

    expect(
      within(dialog).getByText("Mercado Pago bakery has no amount"),
    ).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
  });

  it("states an excess over the amount received", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({
        transaction: inflowFixture({}, 1000),
        candidates: [candidate(expense, 1500, 1500)],
      }),
    });

    const dialog = await openDialog();
    await box(dialog, /Pix enviado EVERTON/);

    expect(
      within(dialog).getByText(catalogEn["reimbursement.excess"]),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(catalogEn["reimbursement.status.over"]),
    ).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
  });

  it("checks the expenses that add up to the amount received", async () => {
    await renderApp(page, {
      fetch: reimbursementApi({
        candidates,
        suggestion: [expenseID],
      }),
    });

    const dialog = await openDialog();
    expect(
      await within(dialog).findByText("Pix enviado EVERTON", {
        selector: "p span",
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["reimbursement.exactApply"],
      }),
    );

    expect(await box(dialog, /Pix enviado EVERTON/)).toBeChecked();
    expect(await box(dialog, /Mercado Pago bakery/)).not.toBeChecked();
    expect(submit(dialog)).toBeEnabled();
  });

  it("says the expenses did not load and reads them again", async () => {
    let failing = true;
    await renderApp(page, {
      fetch: reimbursementApi({
        candidatesResponse: () =>
          failing
            ? problem(500, "internal")
            : json(200, { items: [candidate(expense, 1500)] }),
      }),
    });

    const dialog = await openDialog();
    const retry = await within(dialog).findByRole("button", {
      name: catalogEn["reimbursement.retry"],
    });
    expect(
      within(dialog).getByText(catalogEn["reimbursement.failedTitle"]),
    ).toBeInTheDocument();
    failing = false;
    await userEvent.click(retry);

    expect(await box(dialog, /Pix enviado EVERTON/)).not.toBeChecked();
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
