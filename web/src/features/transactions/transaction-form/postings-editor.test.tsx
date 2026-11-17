import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import type { EntryRow } from "@/features/transactions/entry-model/entry-kind";
import { PostingsEditor } from "@/features/transactions/transaction-form/postings-editor";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Account = components["schemas"]["Account"];

describe("PostingsEditor", () => {
  it("shows no value field on rows in the base currency", () => {
    renderWithProviders(
      <Host rows={[row("checking", -500), row("food", 500)]} />,
      {
        fetch: fakeApi({}),
      },
    );

    expect(screen.queryByRole("spinbutton", { name: valueOf(1) })).toBeNull();
    expect(screen.getByText(catalogEn["entry.balanced"])).toBeInTheDocument();
  });

  // DM1: a row on an account in another currency counts by its value in the base currency.
  it("asks a row in another currency for its value and balances by it", async () => {
    renderWithProviders(
      <Host rows={[row("wallet", -1000), row("food", 5483)]} />,
      {
        fetch: fakeApi({}),
      },
    );

    expect(screen.queryByRole("spinbutton", { name: valueOf(2) })).toBeNull();
    expect(screen.queryByText(catalogEn["entry.balanced"])).toBeNull();

    await userEvent.type(
      screen.getByRole("spinbutton", { name: valueOf(1) }),
      "54.83",
    );
    await userEvent.tab();

    expect(
      await screen.findByText(catalogEn["entry.balanced"]),
    ).toBeInTheDocument();
    expect(last[0]).toMatchObject({
      accountId: "wallet",
      amount: -1000,
      baseAmount: 5483,
    });
  });
});

let last: EntryRow[] = [];

const accounts: Account[] = [
  account("checking", "asset", "BRL"),
  account("wallet", "asset", "USD"),
  account("food", "expense", "BRL"),
];

function Host({ rows }: { rows: EntryRow[] }) {
  const [value, setValue] = useState(rows);

  return (
    <PostingsEditor
      rows={value}
      accounts={accounts}
      baseCurrency="BRL"
      scale={() => 2}
      errors={{}}
      onChange={(next) => {
        last = next;
        setValue(next);
      }}
    />
  );
}

function account(id: string, cls: Account["class"], currency: string): Account {
  return {
    id,
    name: id,
    class: cls,
    currency,
    opened_on: "2026-01-01",
    yield_mode: "none",
  };
}

function row(accountId: string, amount: number): EntryRow {
  return { accountId, amount, memo: "" };
}

function valueOf(position: number): string {
  return catalogEn["entry.row.baseAmount"]
    .replace("{currency}", "BRL")
    .replace("{index}", String(position));
}
