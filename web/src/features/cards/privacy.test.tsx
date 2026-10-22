import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { MASK } from "@/privacy/mask";
import {
  accountRoutes,
  cardID,
  cardRoutes,
  closedStatementID,
  money,
  statementFixtures,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const postings = [
  {
    transaction_id: "tx1",
    date: "2026-09-20",
    description: "Mercado",
    card_role: "charge",
    amount: money(-30000),
  },
  {
    transaction_id: "tx2",
    date: "2026-09-20",
    description: "Geladeira",
    card_role: "charge",
    amount: money(-150000),
    installment: { plan_id: "plan1", number: 2, count: 10 },
  },
  {
    transaction_id: "tx3",
    date: "2026-09-25",
    description: "Pagamento",
    card_role: "payment",
    amount: money(90000),
  },
];

function api() {
  return fakeApi(
    accountRoutes({
      ...cardRoutes(),
      [`GET /api/v1/statements/${closedStatementID}`]: () =>
        json(200, { ...statementFixtures[0], postings }),
      [`GET /api/v1/accounts/${cardID}/statement-placement`]: () =>
        json(200, {
          reference: "2026-11",
          closing_date: "2026-11-05",
          due_date: "2026-11-12",
        }),
    }),
  );
}

async function settle() {
  await waitFor(() => {
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("cards with the amounts hidden", () => {
  it("masks the figures and the cards of the cards page", async () => {
    hideAmounts();
    const { container } = await renderApp("/cards", { fetch: api() });
    await screen.findByRole("article", { name: /Itaú Visa/ });
    await settle();
    expect(screen.getAllByText(new RegExp(MASK)).length).toBeGreaterThan(0);
    expectNoAmounts(container, ["2,500.00", "1,800.00", "5,500.00"]);
  });

  it("masks every tab of a card", async () => {
    hideAmounts();
    const { container } = await renderApp(`/cards/${cardID}`, {
      fetch: api(),
    });
    const tabs = await screen.findAllByRole("tab");
    for (const tab of tabs) {
      await userEvent.click(tab);
      await settle();
      expectNoAmounts(container, []);
    }
  });

  it("masks a statement and its lines", async () => {
    hideAmounts();
    const { container } = await renderApp(
      `/cards/${cardID}/statements/${closedStatementID}`,
      { fetch: api() },
    );
    await screen.findByRole("region", { name: "Statement figures" });
    await settle();
    expectNoAmounts(container, ["900.00", "1,500.00", "300.00"]);
  });
});
