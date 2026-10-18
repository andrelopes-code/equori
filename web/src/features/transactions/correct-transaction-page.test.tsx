import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  checkingID,
  foodID,
  leisureID,
  payeeID,
  savingsID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const label = catalogPtBR;

function newApi(
  putResponses: (() => Response)[],
  stored: Record<string, unknown> = transactionFixture(),
) {
  const puts: unknown[] = [];
  let version = 3;
  const fetch = fakeApi({
    ...sharedRoutes,
    [`GET /api/v1/transactions/${txID}`]: () =>
      json(200, { ...stored, version }),
    [`PUT /api/v1/transactions/${txID}`]: async (req) => {
      puts.push(await req.json());
      const respond = putResponses[puts.length - 1];
      // The conflicting write is the one that moved the stored version.
      if (puts.length === 1) version = 4;
      return respond?.() ?? json(200, { ...stored, version: 5 });
    },
  });
  return { fetch, puts };
}

function postingAmount(n: number): string {
  return label["transactions.new.postingAmount"].replace("{n}", String(n));
}

function money(amount: number) {
  return { amount, currency: "BRL" };
}

async function type(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  text: string,
) {
  const field = await screen.findByRole(
    name === label["transactions.new.amount"] ? "spinbutton" : "textbox",
    { name },
  );
  await user.clear(field);
  await user.type(field, text);
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("textbox", { name: label["transaction.correct.reason"] }),
    "wrong value",
  );
  await user.click(
    screen.getByRole("button", { name: label["transaction.correct.save"] }),
  );
}

const unchanged = {
  date: "2026-10-10",
  description: "Weekly shop",
  payee_id: payeeID,
  tags: ["food"],
};

// A card-style posting: every field the form does not model.
const richQuick = transactionFixture({
  postings: [
    {
      id: "p1",
      account_id: checkingID,
      amount: money(-12000),
      weight: money(-12000),
      status: "cleared",
      settled_on: "2026-10-11",
      statement: "2026-10",
      original: { amount: -2500, currency: "USD" },
    },
    {
      id: "p2",
      account_id: foodID,
      amount: money(12000),
      weight: money(12000),
      status: "pending",
      memo: "bread",
    },
  ],
});

const richFree = transactionFixture({
  postings: [
    {
      id: "p1",
      account_id: checkingID,
      amount: money(-12000),
      weight: money(-12000),
      status: "cleared",
      settled_on: "2026-10-11",
    },
    {
      id: "p2",
      account_id: foodID,
      amount: money(8000),
      weight: money(8000),
      status: "pending",
      statement: "2026-10",
      memo: "bread",
    },
    {
      id: "p3",
      account_id: leisureID,
      amount: money(4000),
      weight: money(4000),
      status: "pending",
    },
  ],
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  writeLocale("pt-BR");
});

describe("correct transaction", () => {
  it("opens an expense in quick entry, prefilled, and requires a reason", async () => {
    const { fetch, puts } = newApi([]);
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    expect(
      (
        await screen.findByRole("textbox", {
          name: label["transactions.new.description"],
        })
      ).getAttribute("value"),
    ).toBe("Weekly shop");
    expect(
      screen
        .getByRole("spinbutton", { name: label["transactions.new.amount"] })
        .getAttribute("value")
        ?.replace(/\s+/g, " "),
    ).toBe("R$ 120,00");
    expect(
      screen.getByRole("combobox", {
        name: label["transactions.new.category"],
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: postingAmount(1) })).toBe(
      null,
    );
    await user.click(
      screen.getByRole("button", { name: label["transaction.correct.save"] }),
    );
    expect(
      await screen.findByText(label["transaction.correct.reasonRequired"]),
    ).toBeTruthy();
    expect(puts).toEqual([]);
  });

  it("opens two balance accounts as a transfer", async () => {
    const { fetch } = newApi(
      [],
      transactionFixture({
        postings: [
          {
            id: "p1",
            account_id: checkingID,
            amount: money(-5000),
            weight: money(-5000),
            status: "cleared",
          },
          {
            id: "p2",
            account_id: savingsID,
            amount: money(5000),
            weight: money(5000),
            status: "cleared",
          },
        ],
      }),
    );
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    expect(
      await screen.findByRole("combobox", {
        name: label["transactions.new.from"],
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: label["transactions.new.to"] }),
    ).toBeTruthy();
  });

  it("opens any other shape as free postings", async () => {
    const { fetch } = newApi([], richFree);
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    expect(
      (await screen.findByRole("spinbutton", { name: postingAmount(1) }))
        .getAttribute("value")
        ?.replace(/\s+/g, " "),
    ).toBe("-R$ 120,00");
    expect(
      screen.getByRole("spinbutton", { name: postingAmount(3) }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: label["transactions.new.quick"] }),
    ).toBe(null);
  });

  it("sends the loaded version, the reason and the stored posting fields, then opens the transaction", async () => {
    const { fetch, puts } = newApi([]);
    const user = userEvent.setup();
    const { router } = await renderApp(`/transactions/${txID}/correct`, {
      fetch,
    });
    await screen.findByRole("spinbutton", {
      name: label["transactions.new.amount"],
    });
    await save(user);
    await waitFor(() => {
      expect(puts).toEqual([
        {
          ...unchanged,
          postings: [
            {
              account_id: checkingID,
              amount: money(-12000),
              weight: money(-12000),
              status: "cleared",
            },
            {
              account_id: foodID,
              amount: money(12000),
              weight: money(12000),
              status: "pending",
            },
          ],
          expected_version: 3,
          reason: "wrong value",
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  it("keeps the unmodeled posting fields when only the amount changes", async () => {
    const { fetch, puts } = newApi([], richQuick);
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    await type(user, label["transactions.new.amount"], "150,00");
    await save(user);
    // The weight is a value in the balancing currency, so it does not survive an amount change.
    await waitFor(() => {
      expect(puts).toEqual([
        {
          ...unchanged,
          postings: [
            {
              account_id: checkingID,
              amount: money(-15000),
              status: "cleared",
              settled_on: "2026-10-11",
              statement: "2026-10",
              original: { amount: -2500, currency: "USD" },
            },
            {
              account_id: foodID,
              amount: money(15000),
              status: "pending",
              memo: "bread",
            },
          ],
          expected_version: 3,
          reason: "wrong value",
        },
      ]);
    });
  });

  it("keeps every posting field of free postings when only the description changes", async () => {
    const { fetch, puts } = newApi([], richFree);
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    await type(user, label["transactions.new.description"], "Weekly shop 2");
    await save(user);
    await waitFor(() => {
      expect(puts).toEqual([
        {
          ...unchanged,
          description: "Weekly shop 2",
          postings: [
            {
              account_id: checkingID,
              amount: money(-12000),
              weight: money(-12000),
              status: "cleared",
              settled_on: "2026-10-11",
            },
            {
              account_id: foodID,
              amount: money(8000),
              weight: money(8000),
              status: "pending",
              statement: "2026-10",
              memo: "bread",
            },
            {
              account_id: leisureID,
              amount: money(4000),
              weight: money(4000),
              status: "pending",
            },
          ],
          expected_version: 3,
          reason: "wrong value",
        },
      ]);
    });
  });

  it("keeps the edits on a version conflict and reapplies them on the current version", async () => {
    const { fetch, puts } = newApi([() => problem(409, "version_conflict")]);
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    await type(user, label["transactions.new.amount"], "150,00");
    await save(user);
    const message = await screen.findByText(
      label["transaction.correct.conflict"].replace("{version}", "4"),
    );
    expect(message.closest("p")).not.toBeNull();
    expect(
      screen
        .getByRole("spinbutton", { name: label["transactions.new.amount"] })
        .getAttribute("value")
        ?.replace(/\s+/g, " "),
    ).toBe("R$ 150,00");
    await user.click(
      screen.getByRole("button", {
        name: label["transaction.correct.reapply"],
      }),
    );
    const postings = [
      {
        account_id: checkingID,
        amount: money(-15000),
        status: "cleared",
      },
      { account_id: foodID, amount: money(15000), status: "pending" },
    ];
    await waitFor(() => {
      expect(puts).toEqual([
        { ...unchanged, postings, expected_version: 3, reason: "wrong value" },
        { ...unchanged, postings, expected_version: 4, reason: "wrong value" },
      ]);
    });
  });
});
