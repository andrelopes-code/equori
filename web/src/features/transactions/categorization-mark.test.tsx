import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  accounts,
  checkingID,
  foodID,
  sharedRoutes,
  transactionFixture,
} from "@/testing/transaction-api";

const ruleID = "55555555-5555-4555-8555-555555555555";
const eur = (amount: number) => ({ amount, currency: "EUR" });

const methods = [
  ["d1111111-1111-4111-8111-111111111111", "Bakery", "rule"],
  ["d2222222-2222-4222-8222-222222222222", "Market", "source"],
  ["d3333333-3333-4333-8333-333333333333", "Pharmacy", "manual"],
  ["d4444444-4444-4444-8444-444444444444", "Cinema", "history"],
] as const;

const transactions = methods.map(([id, description]) =>
  transactionFixture({
    id,
    description,
    payee_id: undefined,
    tags: [],
    balancing_currency: "EUR",
    postings: [
      {
        id: `${id}-a`,
        account_id: checkingID,
        amount: eur(-1250),
        weight: eur(-1250),
        status: "cleared",
      },
      {
        id: `${id}-b`,
        account_id: foodID,
        amount: eur(1250),
        weight: eur(1250),
        status: "cleared",
      },
    ],
  }),
);

// A region other than BR and a base currency other than BRL.
function api(asked: URL[]) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "en",
        region: "DE",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "EUR", type: "currency", scale: 2, name: "Euro" }],
      }),
    "GET /api/v1/accounts": () =>
      json(200, {
        items: accounts.map((a) => ({ ...a, currency: "EUR" })),
      }),
    "GET /api/v1/transactions": () => json(200, { items: transactions }),
    "GET /api/v1/categorizations": (req: Request) => {
      asked.push(new URL(req.url));
      return json(200, {
        items: methods.map(([id, , method]) => ({
          transaction_id: id,
          method,
          ...(method === "rule" ? { rule_id: ruleID } : {}),
          decided_at: "2026-10-10T12:00:00Z",
        })),
      });
    },
  });
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole("rowheader", { name: new RegExp(name) });
  const r = row.closest('[role="row"]');
  if (!(r instanceof HTMLElement)) throw new Error(`no row for ${name}`);
  return r;
}

beforeEach(() => {
  localStorage.clear();
});

describe("categorization method on the transaction list", () => {
  it.each([
    ["Bakery", "method.mark.rule"],
    ["Market", "method.mark.source"],
    ["Pharmacy", "method.mark.manual"],
    ["Cinema", "method.mark.history"],
  ] as const)("marks %s with its method", async (name, key) => {
    await renderApp("/transactions", { fetch: api([]) });
    await screen.findByRole("rowheader", { name: new RegExp(name) });
    expect(
      await within(rowOf(name)).findByText(catalogEn[key]),
    ).toBeInTheDocument();
  });

  it("links the rule mark to the rule", async () => {
    await renderApp("/transactions", { fetch: api([]) });
    await screen.findByRole("rowheader", { name: /Bakery/ });
    const link = await within(rowOf("Bakery")).findByRole("link", {
      name: catalogEn["method.mark.rule"],
    });
    expect(link).toHaveAttribute("href", `/categories/rules/${ruleID}`);
  });

  it("asks the methods of a page in one call", async () => {
    const asked: URL[] = [];
    await renderApp("/transactions", { fetch: api(asked) });
    await within(await screen.findByRole("grid")).findByText(
      catalogEn["method.mark.manual"],
    );
    expect(asked).toHaveLength(1);
    expect(asked[0]?.searchParams.getAll("transaction_id")).toEqual(
      methods.map(([id]) => id),
    );
  });

  it("puts the mark on the line of details on a phone", async () => {
    await renderApp("/transactions", { fetch: api([]), width: 390 });
    const title = await screen.findByRole("rowheader", { name: /Pharmacy/ });
    await waitFor(() => {
      expect(
        within(title).getByText(catalogEn["method.mark.manual"]),
      ).toBeInTheDocument();
    });
  });
});
