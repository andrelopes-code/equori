import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  expenseFixture,
  expenseID,
  inflowFixture,
  otherExpenseID,
  repaymentApi,
  source,
  sourceID,
  type Sent,
} from "@/testing/reimbursement-api";

const page = `/transactions/${expenseID}`;
const money = (amount: number) => ({ amount, currency: "BRL" });
const expense = {
  ...expenseFixture(expenseID, "Pix enviado EVERTON", "2026-10-17", 5000),
  referenced_by: [
    {
      type: "reimbursement_of",
      source: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      amount: money(1000),
    },
  ],
};
const received = inflowFixture(
  {
    id: sourceID,
    date: "2026-10-20",
    version: 3,
    links: [
      { type: "reimbursement_of", target: otherExpenseID, amount: money(2000) },
    ],
  },
  10000,
);

async function openDialog() {
  await userEvent.click(
    await screen.findByRole("button", { name: catalogEn["detail.repay"] }),
  );
  return screen.findByRole("dialog");
}

const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: catalogEn["repayment.submit"] });

describe("repayment dialog", () => {
  it("fills what the expense still needs and keeps the other allocations of the inflow", async () => {
    const sent: Sent[] = [];
    await renderApp(page, {
      fetch: repaymentApi({
        expense,
        sent,
        sources: [source(received, 10000)],
      }),
    });

    const dialog = await openDialog();
    expect(submit(dialog)).toBeDisabled();
    await userEvent.click(
      await within(dialog).findByRole("radio", {
        name: /Transferência Recebida/,
      }),
    );
    await userEvent.click(submit(dialog));

    await waitFor(() => {
      expect(sent).toEqual([
        {
          path: sourceID,
          body: {
            expected_version: 3,
            allocations: [
              { original_id: otherExpenseID, amount: money(2000) },
              { original_id: expenseID, amount: money(4000) },
            ],
          },
        },
      ]);
    });
  });

  it("takes only what is free when the inflow has less than the expense needs", async () => {
    const sent: Sent[] = [];
    await renderApp(page, {
      fetch: repaymentApi({ expense, sent, sources: [source(received, 2500)] }),
    });

    const dialog = await openDialog();
    await userEvent.click(
      await within(dialog).findByRole("radio", {
        name: /Transferência Recebida/,
      }),
    );
    await userEvent.click(submit(dialog));

    await waitFor(() => {
      expect(sent[0]?.body).toMatchObject({
        allocations: [
          { original_id: otherExpenseID, amount: money(2000) },
          { original_id: expenseID, amount: money(2500) },
        ],
      });
    });
  });

  it("says so when no incoming transaction can repay the expense", async () => {
    await renderApp(page, { fetch: repaymentApi({ expense, sources: [] }) });

    const dialog = await openDialog();

    expect(
      await within(dialog).findByText(catalogEn["repayment.empty"]),
    ).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
  });

  it("shows the message of the rule the server refused", async () => {
    await renderApp(page, {
      fetch: repaymentApi({
        expense,
        sources: [source(received, 10000)],
        reimburse: () =>
          problem(422, "validation_failed", {
            errors: [
              {
                field: "allocations[1].original_id",
                message:
                  "reimbursements would total 5100, above the expense 5000",
              },
            ],
          }),
      }),
    });

    const dialog = await openDialog();
    await userEvent.click(
      await within(dialog).findByRole("radio", {
        name: /Transferência Recebida/,
      }),
    );
    await userEvent.click(submit(dialog));

    expect(
      await within(dialog).findByText(
        "reimbursements would total 5100, above the expense 5000",
      ),
    ).toBeInTheDocument();
  });

  it("offers the action to an expense only", async () => {
    await renderApp(`/transactions/${expenseID}`, {
      fetch: repaymentApi({ expense: inflowFixture({ id: expenseID }) }),
    });

    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.queryByRole("button", { name: catalogEn["detail.repay"] }),
    ).not.toBeInTheDocument();
  });
});
