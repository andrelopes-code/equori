import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { OperationBody } from "@/features/assistant/proposal/operation-body";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

type Preview = components["schemas"]["AssistantPreview"];

const usd = (amount: string) => ({ amount, currency: "USD" });

// Spec 2026-11-15 section 7: each operation draws in its own form.
describe("OperationBody", () => {
  it("draws a categorization as a move between two chips and the moved rows", () => {
    drawBody({
      action: "categorize_transactions",
      changes: [
        { field: "category", after: { text: "Dining" } },
        { field: "payee", after: { text: "iFood" } },
      ],
      items: [
        {
          description: "iFood lunch",
          date: "2026-10-08",
          amount: usd("-54.90"),
          account: "Nubank",
          category: "Food",
        },
        {
          description: "Padaria Real",
          date: "2026-10-21",
          amount: usd("-18.50"),
          account: "Nubank",
        },
      ],
    });

    expect(screen.getByText(catalogEn["assistant.body.from"])).toBeVisible();
    expect(screen.getByText("Food, Uncategorized")).toBeVisible();
    expect(screen.getByText(catalogEn["assistant.body.to"])).toBeVisible();
    expect(screen.getByText("Dining")).toBeVisible();
    expect(screen.getByText("iFood lunch")).toBeVisible();
    expect(screen.getByText("10/08 · Nubank")).toBeVisible();
    expect(screen.getByText("\u2212$54.90")).toBeVisible();
    expect(screen.getByText("PR")).toBeVisible();
    expect(screen.getByText("iFood")).toBeVisible();
  });

  it("names the uncategorized label when no moved row has a category", () => {
    drawBody({
      action: "categorize_transactions",
      changes: [{ field: "category", after: { text: "Dining" } }],
      items: [{ description: "iFood lunch" }],
    });

    expect(
      screen.getByText(catalogEn["assistant.body.uncategorized"]),
    ).toBeVisible();
  });

  it("draws a rule as a when and then table with the pattern in code", () => {
    drawBody({
      action: "manage_rule.create_rule",
      changes: [
        { field: "rule", after: { text: "iFood" } },
        { field: "pattern", after: { text: "IFOOD*" } },
        { field: "category", after: { text: "Dining" } },
      ],
    });

    expect(screen.getByText(catalogEn["assistant.body.when"])).toBeVisible();
    expect(screen.getByText(catalogEn["assistant.body.matches"])).toBeVisible();
    expect(screen.getByText("IFOOD*").tagName).toBe("CODE");
    expect(screen.getByText(catalogEn["assistant.body.then"])).toBeVisible();
    expect(screen.getByText("Dining")).toBeVisible();
    expect(screen.getByText("iFood")).toBeVisible();
  });

  it("strikes the voided transaction and writes the reason", () => {
    drawBody({
      action: "void_transaction",
      target: "Outback",
      changes: [{ field: "reason", after: { text: "Duplicate" } }],
      items: [
        {
          description: "Outback",
          date: "2026-10-12",
          amount: usd("-389.00"),
          account: "Nubank",
        },
      ],
    });

    const row = screen.getByText("Outback").closest("[data-struck]");

    expect(row).toHaveAttribute("data-struck", "true");
    expect(within(row as HTMLElement).getByText("\u2212$389.00")).toBeVisible();
    expect(screen.getByText("Reason: Duplicate")).toBeVisible();
  });

  it("draws a recorded transaction as one row and keeps its other fields", () => {
    drawBody({
      action: "record_transaction",
      changes: [
        { field: "date", after: { date: "2026-11-15" } },
        { field: "description", after: { text: "Lunch" } },
        { field: "amount", after: usd("-42.90") },
        { field: "account", after: { text: "Checking" } },
        { field: "category", after: { text: "Dining" } },
      ],
    });

    expect(screen.getByText("Lunch")).toBeVisible();
    expect(screen.getByText("11/15 · Checking")).toBeVisible();
    expect(screen.getByText("\u2212$42.90")).toBeVisible();
    expect(screen.getByText("Dining")).toBeVisible();
  });

  it("draws a schedule with its amount, its period and six month tiles", () => {
    drawBody({
      action: "manage_schedule.create",
      changes: [
        { field: "amount", after: usd("55.90") },
        { field: "account", after: { text: "Nubank" } },
        { field: "date", after: { date: "2026-11-15" } },
      ],
      recurrence: { frequency: "monthly", interval: 1, day: 15 },
    });

    expect(screen.getByText("$55.90")).toBeVisible();
    expect(
      screen.getByText(`${catalogEn["assistant.body.per.monthly"]} · Nubank`),
    ).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Nov 15");
  });

  it("writes the terms of a schedule without a monthly tile list", () => {
    drawBody({
      action: "manage_schedule.create",
      changes: [
        { field: "amount", after: usd("10.00") },
        { field: "terms", after: { text: "Every week on Monday" } },
        { field: "date", after: { date: "2026-11-16" } },
      ],
      recurrence: { frequency: "weekly", interval: 1 },
    });

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("Every week on Monday")).toBeVisible();
    expect(
      screen.getByText(catalogEn["assistant.body.per.weekly"], {
        exact: false,
      }),
    ).toBeVisible();
  });

  it("draws a purchase as quantity times price equals total", () => {
    drawBody({
      action: "record_investment.buy",
      changes: [
        { field: "instrument", after: { text: "PETR4" } },
        { field: "quantity", after: { text: "100" } },
        { field: "price", after: { text: "$34.20" } },
        { field: "amount", after: usd("3420.00") },
        { field: "account", after: { text: "XP" } },
      ],
    });

    expect(screen.getByText("100")).toBeVisible();
    expect(screen.getByText("PETR4")).toBeVisible();
    expect(screen.getByText("$34.20")).toBeVisible();
    expect(screen.getByText(catalogEn["assistant.body.price"])).toBeVisible();
    expect(screen.getByText("$3,420.00")).toBeVisible();
    expect(screen.getByText(catalogEn["assistant.body.total"])).toBeVisible();
    expect(screen.getByText("Paid from XP")).toBeVisible();
  });

  it("draws a credit limit as a gauge named by both amounts", () => {
    drawBody({
      action: "manage_card.set_credit_limit",
      target: "Nubank",
      changes: [
        { field: "limit", before: usd("8000.00"), after: usd("12000.00") },
      ],
    });

    expect(
      screen.getByRole("img", {
        name: "Current: $8,000.00, Requested: $12,000.00",
      }),
    ).toBeVisible();
    expect(screen.getByText(catalogEn["assistant.body.current"])).toBeVisible();
    expect(
      screen.getByText(catalogEn["assistant.body.requested"]),
    ).toBeVisible();
  });

  it("falls back to the field rows when the card had no limit", () => {
    drawBody({
      action: "manage_card.set_credit_limit",
      changes: [{ field: "limit", after: usd("12000.00") }],
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(catalogEn["assistant.field.limit"])).toBeVisible();
    expect(screen.getByText("$12,000.00")).toBeVisible();
  });

  it("draws a payment from the account through the amount to the statement", () => {
    drawBody({
      action: "settle_statement.pay",
      target: "Nubank",
      changes: [
        { field: "statement", after: { text: "2026-11" } },
        { field: "amount", after: usd("2918.38") },
        { field: "account", after: { text: "Itaú" } },
        { field: "date", after: { date: "2026-11-15" } },
      ],
    });

    expect(screen.getByText("Itaú")).toBeVisible();
    expect(screen.getByText("$2,918.38")).toBeVisible();
    expect(screen.getByText("Nov 2026 statement")).toBeVisible();
    expect(screen.getByText("11/15/2026")).toBeVisible();
  });

  it("falls back to the field rows for an action without a body", () => {
    drawBody({
      action: "manage_card.add_card",
      changes: [{ field: "description", after: { text: "Travel card" } }],
    });

    expect(screen.getByText("Travel card")).toBeVisible();
  });

  it("hides every amount while privacy is on, the gauge name included", () => {
    hideAmounts();

    const { container } = drawBody({
      action: "manage_card.set_credit_limit",
      changes: [
        { field: "limit", before: usd("8000.00"), after: usd("12000.00") },
      ],
    });

    expectNoAmounts(container, ["8,000.00", "12,000.00"]);
  });
});

function drawBody(preview: Omit<Preview, "changes"> & Partial<Preview>) {
  return renderWithProviders(
    <OperationBody preview={{ changes: [], ...preview }} />,
    { fetch: fakeApi({}) },
  );
}
