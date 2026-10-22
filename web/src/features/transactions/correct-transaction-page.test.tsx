import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  checkingID,
  foodID,
  payeeID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const money = (amount: number) => ({ amount, currency: "BRL" });

function moved() {
  return transactionFixture({
    version: 4,
    postings: [
      {
        id: "p1",
        account_id: checkingID,
        amount: money(-15000),
        weight: money(-15000),
        status: "cleared",
      },
      {
        id: "p2",
        account_id: foodID,
        amount: money(15000),
        weight: money(15000),
        status: "cleared",
      },
    ],
  });
}

function api(sent: unknown[], answers: (() => Response)[]) {
  let reads = 0;
  return fakeApi({
    ...sharedRoutes,
    [`GET /api/v1/transactions/${txID}`]: () => {
      reads += 1;
      return json(200, reads === 1 ? transactionFixture() : moved());
    },
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${txID}/categorization`]: () =>
      json(200, {
        transaction_id: txID,
        method: "manual",
        decided_at: "2026-10-11T10:00:00Z",
      }),
    [`GET /api/v1/transactions/${txID}/attachments`]: () =>
      json(200, { items: [] }),
    [`PUT /api/v1/transactions/${txID}`]: async (req) => {
      sent.push(await req.json());
      const answer = answers.shift();
      return answer === undefined ? json(200, moved()) : answer();
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("CorrectTransactionPage", () => {
  it("opens on the transaction and sends its version with the reason", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(`/transactions/${txID}/correct`, {
      fetch: api(sent, []),
    });
    const description = await screen.findByRole("textbox", {
      name: catalogEn["facts.description"],
    });
    expect(description).toHaveValue("Weekly shop");
    expect(
      screen.getByRole("textbox", { name: catalogEn["entry.amount"] }),
    ).toHaveValue("120.00");
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["correct.reason"] }),
      "Wrong description",
    );
    await userEvent.clear(description);
    await userEvent.type(description, "Monthly shop");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["correct.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          date: "2026-10-10",
          description: "Monthly shop",
          payee_id: payeeID,
          tags: ["food"],
          postings: [
            { account_id: checkingID, amount: money(-12000) },
            { account_id: foodID, amount: money(12000) },
          ],
          expected_version: 3,
          reason: "Wrong description",
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  it("asks for a reason before sending", async () => {
    const sent: unknown[] = [];
    await renderApp(`/transactions/${txID}/correct`, { fetch: api(sent, []) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["correct.save"] }),
    );
    expect(
      screen.getByText(catalogEn["correct.reasonRequired"]),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("reads the transaction again on a stale version and lets the reader overwrite it", async () => {
    const sent: unknown[] = [];
    await renderApp(`/transactions/${txID}/correct`, {
      fetch: api(sent, [() => problem(409, "version_conflict")]),
    });
    await userEvent.type(
      await screen.findByRole("textbox", { name: catalogEn["correct.reason"] }),
      "Fix",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["correct.save"] }),
    );
    expect(
      await screen.findByText(catalogEn["conflict.title"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The transaction was read again. Changed since: Amount. Your form keeps what you wrote.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["conflict.overwrite"] }),
    );
    await waitFor(() => {
      expect(sent).toHaveLength(2);
    });
    expect(sent[1]).toMatchObject({
      expected_version: 4,
      postings: [
        { account_id: checkingID, amount: money(-12000) },
        { account_id: foodID, amount: money(12000) },
      ],
    });
  });

  it("names a reconciled transaction instead of reporting a stale version", async () => {
    const sent: unknown[] = [];
    await renderApp(`/transactions/${txID}/correct`, {
      fetch: api(sent, [() => problem(409, "posting_reconciled")]),
    });
    await userEvent.type(
      await screen.findByRole("textbox", { name: catalogEn["correct.reason"] }),
      "Fix",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["correct.save"] }),
    );
    expect(
      await screen.findByText(catalogEn["problem.posting_reconciled"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(catalogEn["conflict.title"])).toBeNull();
    expect(sent).toHaveLength(1);
  });
});
