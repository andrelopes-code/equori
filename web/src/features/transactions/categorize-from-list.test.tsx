import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  accounts,
  checkingID,
  foodID,
  leisureID,
  sharedRoutes,
  transactionFixture,
} from "@/testing/transaction-api";

const uncategorizedID = "99999999-9999-4999-8999-999999999999";
const firstID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const secondID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const thirdID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const money = (amount: number) => ({ amount, currency: "BRL" });

function uncategorized(id: string, description: string, version = 1) {
  return transactionFixture({
    id,
    description,
    payee_id: undefined,
    tags: [],
    version,
    postings: [
      {
        id: `${id}-a`,
        account_id: checkingID,
        amount: money(-3890),
        weight: money(-3890),
        status: "cleared",
      },
      {
        id: `${id}-b`,
        account_id: uncategorizedID,
        amount: money(3890),
        weight: money(3890),
        status: "cleared",
      },
    ],
  });
}

const first = uncategorized(firstID, "UBER *EATS", 2);
const second = uncategorized(secondID, "PADARIA SAO JOAO", 5);
const third = uncategorized(thirdID, "UBER *EATS", 1);

interface Sent {
  path: string;
  body: unknown;
}

function api(sent: Sent[]) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () =>
      json(200, {
        items: [
          ...accounts,
          {
            id: uncategorizedID,
            name: "Uncategorized expense",
            class: "expense",
            currency: "BRL",
            system_role: "uncategorized_expense",
          },
        ],
      }),
    "GET /api/v1/transactions": (req) => {
      const query = new URL(req.url).searchParams;
      if (query.get("q") === "UBER *EATS")
        return json(200, { items: [first, third] });
      if (query.get("limit") === "200")
        return json(200, { items: [first, second, third] });
      return json(200, { items: [first, second] });
    },
    [`POST /api/v1/transactions/${firstID}/categorize`]: async (req) => {
      const body = (await req.json()) as {
        expected_version: number;
        parts: { account_id: string }[];
      };
      sent.push({ path: `categorize ${firstID}`, body });
      const category = body.parts[0]?.account_id ?? uncategorizedID;
      return json(200, {
        ...first,
        version: body.expected_version + 1,
        postings: [
          {
            id: `${firstID}-a`,
            account_id: checkingID,
            amount: money(-3890),
            weight: money(-3890),
            status: "cleared",
          },
          {
            id: "n",
            account_id: category,
            amount: money(3890),
            weight: money(3890),
            status: "cleared",
          },
        ],
      });
    },
    "POST /api/v1/transactions/categorize": async (req) => {
      const body = (await req.json()) as { items: { id: string }[] };
      sent.push({ path: "bulk", body });
      return json(200, {
        results: body.items.map((item, i) =>
          i === 0
            ? { id: item.id, status: "categorized", version: 9 }
            : { id: item.id, status: "version_conflict" },
        ),
      });
    },
  });
}

function rowOf(text: string): HTMLElement {
  const row = screen.getAllByText(text)[0]?.closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${text}`);
  return row;
}

beforeEach(() => {
  localStorage.clear();
});

describe("categorizing from the list", () => {
  it("categorizes a row in its cell, offers the similar ones and undoes", async () => {
    const sent: Sent[] = [];
    await renderApp("/transactions", { fetch: api(sent) });
    await screen.findByText("PADARIA SAO JOAO");
    await userEvent.click(
      within(rowOf("UBER *EATS")).getByRole("button", {
        name: catalogEn["transactions.categorize"],
      }),
    );
    const picker = await screen.findByRole("combobox", {
      name: catalogEn["category.label"],
    });
    await userEvent.type(picker, "Lazer");
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => {
      expect(sent[0]).toEqual({
        path: `categorize ${firstID}`,
        body: {
          expected_version: 2,
          parts: [{ account_id: leisureID, amount: money(3890) }],
        },
      });
    });
    // The toast and the polite announcer both hold the words.
    expect(await screen.findAllByText("Categorized as Lazer")).not.toHaveLength(
      0,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Apply to 1 similar" }),
    );
    await waitFor(() => {
      expect(sent[1]).toEqual({
        path: "bulk",
        body: {
          category_id: leisureID,
          items: [{ id: thirdID, expected_version: 1 }],
        },
      });
    });
  });

  it("puts the previous parts back on undo", async () => {
    const sent: Sent[] = [];
    await renderApp("/transactions", { fetch: api(sent) });
    await screen.findByText("PADARIA SAO JOAO");
    await userEvent.click(
      within(rowOf("UBER *EATS")).getByRole("button", {
        name: catalogEn["transactions.categorize"],
      }),
    );
    const picker = await screen.findByRole("combobox", {
      name: catalogEn["category.label"],
    });
    await userEvent.type(picker, "Mercado");
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["categorize.undo"] }),
    );
    await waitFor(() => {
      expect(sent.at(-1)).toEqual({
        path: `categorize ${firstID}`,
        body: {
          expected_version: 3,
          parts: [{ account_id: uncategorizedID, amount: money(3890) }],
        },
      });
    });
    expect(sent[0]?.body).toMatchObject({ parts: [{ account_id: foodID }] });
  });

  it("categorizes a selection in one request and reports the refusals", async () => {
    const sent: Sent[] = [];
    await renderApp("/transactions", { fetch: api(sent) });
    await screen.findByText("PADARIA SAO JOAO");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select UBER *EATS" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select PADARIA SAO JOAO" }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["selection.categorize"] }),
    );
    const picker = await screen.findByRole("combobox", {
      name: catalogEn["category.label"],
    });
    await userEvent.type(picker, "Mercado");
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => {
      expect(sent[0]).toEqual({
        path: "bulk",
        body: {
          category_id: foodID,
          items: [
            { id: firstID, expected_version: 2 },
            { id: secondID, expected_version: 5 },
          ],
        },
      });
    });
    expect(
      await screen.findByText("1 categorized as Mercado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 changed since the list was read and were left as they are.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("2 selected")).toBeNull();
    });
  });
});
