import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { MASK } from "@/privacy/mask";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import {
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const groceries = transactionFixture();

function api() {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/transactions": () => json(200, { items: [groceries] }),
    [`GET /api/v1/transactions/${txID}`]: () => json(200, groceries),
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
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("transactions with the amounts hidden", () => {
  it("masks the amounts of the list, its totals and its day headers", async () => {
    hideAmounts();
    const { container } = await renderApp("/transactions", {
      fetch: api(),
      today: "2026-10-17",
    });
    await screen.findByText("Padaria");
    expect(screen.getAllByText(new RegExp(MASK)).length).toBeGreaterThan(0);
    expectNoAmounts(container, ["120.00"]);
  });

  it("masks the amounts of a transaction's detail", async () => {
    hideAmounts();
    const { container } = await renderApp(`/transactions/${txID}`, {
      fetch: api(),
      today: "2026-10-17",
    });
    await screen.findAllByText("Padaria");
    expectNoAmounts(container, ["120.00"]);
    expect(document.body.innerHTML).not.toMatch(/120\.00/);
  });

  it("shows and hides the cells of the mounted grid when the toggle flips", async () => {
    const user = userEvent.setup();
    const { container } = await renderApp("/transactions", {
      fetch: api(),
      today: "2026-10-17",
      width: 390,
    });
    const row = (await screen.findByText("Padaria")).closest('[role="row"]');
    if (!(row instanceof HTMLElement)) throw new Error("no row");
    expect(within(row).getByText("−R$120.00")).toBeInTheDocument();
    const toggle = screen.getByRole("button", {
      name: catalogEn["privacy.hide"],
    });
    await user.click(toggle);
    expectNoAmounts(container, ["120.00"]);
    expect(within(row).getByText(new RegExp(MASK))).toBeInTheDocument();
    await user.click(toggle);
    expect(within(row).getByText("−R$120.00")).toBeInTheDocument();
  });
});
