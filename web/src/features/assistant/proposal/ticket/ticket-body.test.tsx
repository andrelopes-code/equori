import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { TicketBody } from "@/features/assistant/proposal/ticket/ticket-body";
import { fakeApi } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

type Preview = components["schemas"]["AssistantPreview"];

const usd = (amount: string) => ({ amount, currency: "USD" });

const purchase: Preview = {
  action: "record_investment.buy",
  changes: [
    { field: "instrument", after: { text: "VT" } },
    { field: "quantity", after: { text: "1200.500" } },
    { field: "price", after: { text: "34.2" } },
    { field: "fees", after: usd("2.10") },
    { field: "amount", after: usd("41057.10") },
    { field: "net", after: usd("-41059.20") },
    { field: "account", after: { text: "Checking" } },
    { field: "date", after: { date: "2026-11-25" } },
    { field: "settlement", after: { date: "2026-11-27" } },
  ],
};

function order(code: string) {
  return {
    description: code,
    side: "buy",
    quantity: { text: "1" },
    price: { text: "10" },
    amount: usd("10.00"),
  };
}

function draw(preview: Preview) {
  return renderWithProviders(<TicketBody preview={preview} />, {
    fetch: fakeApi({}),
    today: "2026-11-25",
  });
}

describe("TicketBody", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("draws a purchase with its price, its net and its two dates", () => {
    draw(purchase);

    expect(screen.getByText("1,200.5")).toBeVisible();
    expect(screen.getByText("VT")).toBeVisible();
    expect(screen.getByText("at $34.20")).toBeVisible();
    expect(screen.getByText("$41,057.10")).toBeVisible();
    expect(screen.getByText("Leaves Checking")).toBeVisible();
    expect(screen.getByText("$41,059.20")).toBeVisible();
    expect(screen.getByText("Trade · holding")).toBeVisible();
    expect(screen.getByText("Settlement · money")).toBeVisible();
    expect(screen.getByText("Fri, 11/27/2026")).toBeVisible();
  });

  it("names the cash without an account when the proposal has none", () => {
    draw({
      ...purchase,
      changes: purchase.changes.filter((c) => c.field !== "account"),
    });

    expect(screen.getByText("Leaves the cash")).toBeVisible();
  });

  it("shows five orders of a note, then the rest", async () => {
    draw({
      action: "record_brokerage_note",
      changes: [{ field: "net", after: usd("-70.00") }],
      items: ["A1", "B2", "C3", "D4", "E5", "F6", "G7"].map(order),
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText("1 F6")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Show 2 more orders" }),
    );

    expect(screen.getByText("1 G7")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the settlement of each order when they differ", () => {
    draw({
      action: "record_brokerage_note",
      changes: [{ field: "date", after: { date: "2026-11-25" } }],
      items: [
        { ...order("A1"), date: "2026-11-27" },
        { ...order("B2"), date: "2026-11-25" },
      ],
    });

    expect(
      screen.getByText(/Purchase at \$10\.00 · settles 11\/27/),
    ).toBeVisible();
  });

  it("strikes the value a correction replaces", () => {
    draw({
      ...purchase,
      action: "record_investment.correct",
      changes: [
        { field: "reason", after: { text: "3 units" } },
        { field: "kind", after: { text: "buy" } },
        ...purchase.changes.map((c) =>
          c.field === "amount" ? { ...c, before: usd("100.00") } : c,
        ),
      ],
    });

    expect(screen.getByText(/\$100\.00/, { selector: "s" })).toBeVisible();
    expect(screen.getByText("Reason: 3 units")).toBeVisible();
  });

  it.each([
    [[{ field: "rate", after: { text: "110" } }], "110%", "of CDI"],
    [[], "CDI", undefined],
    [[{ field: "spread", after: { text: "6.5" } }], "CDI", "+ 6.5%"],
  ])("writes the rate of a contract", (changes, figure, code) => {
    draw({
      action: "record_fixed_income",
      target: "CDB",
      changes: [...changes, { field: "index", after: { text: "cdi" } }],
    });

    expect(screen.getByText(figure)).toBeVisible();
    if (code !== undefined) expect(screen.getByText(code)).toBeVisible();
  });

  it("hides every amount and quantity while privacy is on", () => {
    hideAmounts();
    const { container } = draw(purchase);

    expectNoAmounts(container, []);
    expect(screen.queryByText("1,200.5")).toBeNull();
  });
});
