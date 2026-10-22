import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { MASK } from "@/privacy/mask";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const BRL = (amount: number) => ({ amount, currency: "BRL" });

const checking = {
  id: "0b9a6c1e-2f43-4d1a-9a55-7c1f0e3d2b10",
  name: "Checking",
  class: "asset",
  kind: "checking",
  currency: "BRL",
};

const card = {
  id: "5d1f3a20-9c1b-4e7a-8f00-2a6b4c8d9e01",
  name: "Visa",
  class: "liability",
  kind: "credit_card",
  currency: "BRL",
  card: {
    credit_limit: BRL(500000),
    available_limit: BRL(300000),
  },
};

function statement(reference: string, due: number, paid: number) {
  return {
    id: `s-${reference}`,
    account_id: card.id,
    reference,
    closing_date: `${reference}-03`,
    due_date: `${reference}-10`,
    opening: BRL(0),
    charges: BRL(due),
    credits: BRL(0),
    amount_due: BRL(due),
    payments: BRL(paid),
    unpaid: BRL(due - paid),
    status: "partially_paid",
    reconciled: false,
  };
}

function api() {
  return fakeApi({
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/me": () => json(200, { id: 1, email: "owner@example.com" }),
    "GET /api/v1/accounts": () => json(200, { items: [checking, card] }),
    [`GET /api/v1/accounts/${card.id}/statements`]: () =>
      json(200, { items: [statement("2026-10", 150000, 50000)] }),
    "GET /api/v1/commitments": () =>
      json(200, {
        month: "2026-10",
        installments: BRL(30000),
        occurrences: BRL(250000),
        total: BRL(280000),
      }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/balances": (req) =>
      json(200, {
        items: [
          {
            account_id: checking.id,
            date: "2026-10-17",
            basis: new URL(req.url).searchParams.get("basis"),
            balance: BRL(123456),
          },
        ],
      }),
  });
}

async function settle() {
  await waitFor(() => {
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("admin with the amounts hidden", () => {
  it("masks the overview", async () => {
    hideAmounts();
    const { container } = await renderApp("/admin", { fetch: api() });
    await screen.findByText(
      catalogEn["admin.overview.due"].replace("{month}", "2026-10"),
    );
    await settle();
    expect(screen.getAllByText(new RegExp(MASK)).length).toBeGreaterThan(0);
    expectNoAmounts(container, ["1500.00", "2800.00"]);
  });

  it("masks the cells and the tiles of the accounts tab", async () => {
    hideAmounts();
    const user = userEvent.setup();
    const { container } = await renderApp("/admin", { fetch: api() });
    await user.click(
      await screen.findByRole("tab", { name: catalogEn["admin.tab.accounts"] }),
    );
    await screen.findByRole("table", {
      name: catalogEn["admin.accounts.table"],
    });
    await settle();
    expectNoAmounts(container, ["1234.56", "1000.00"]);
  });
});
