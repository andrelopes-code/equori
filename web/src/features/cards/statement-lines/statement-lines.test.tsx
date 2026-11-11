import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { StatementLines } from "@/features/cards/statement-lines/statement-lines";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";

type Line = components["schemas"]["StatementPosting"];

function line(role: Line["card_role"]): Line {
  return {
    transaction_id: "tx",
    date: "2026-10-01",
    description: "Line",
    card_role: role,
    amount: { amount: role === "charge" ? -1000 : 1000, currency: "BRL" },
    provisional: false,
  };
}

function amountTone(): string {
  const row = screen.getByText("Line").closest("tr") as HTMLElement;
  const cells = within(row).getAllByRole("cell");

  return cells[1]?.firstElementChild?.getAttribute("data-tone") ?? "inherit";
}

describe("StatementLines", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["a payment", "payment", "success"],
    ["a charge", "charge", "inherit"],
  ] as const)("reads %s", async (_name, role, tone) => {
    renderWithRouter(<StatementLines lines={[line(role)]} scale={() => 2} />, {
      path: "/",
      fetch: fakeApi({}),
    });

    expect(await screen.findByText("Line")).toBeInTheDocument();
    expect(amountTone()).toBe(tone);
  });

  it("keeps the text's own tone when the amounts are hidden", async () => {
    hideAmounts();
    renderWithRouter(
      <StatementLines lines={[line("payment")]} scale={() => 2} />,
      { path: "/", fetch: fakeApi({}) },
    );

    expect(await screen.findByText("Line")).toBeInTheDocument();
    expect(amountTone()).toBe("inherit");
  });
});
