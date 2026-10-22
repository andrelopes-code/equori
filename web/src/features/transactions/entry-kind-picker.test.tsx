import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { EntryKind } from "@/features/transactions/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("EntryKindPicker", () => {
  it("names each kind, describes it by its hint and reports the choice", async () => {
    const chosen: EntryKind[] = [];
    renderWithProviders(
      <EntryKindPicker
        value="expense"
        onChange={(kind) => chosen.push(kind)}
      />,
      { fetch: fakeApi({}) },
    );
    const group = screen.getByRole("radiogroup", {
      name: catalogEn["entry.kind"],
    });
    const expense = screen.getByRole("radio", {
      name: catalogEn["entry.kind.expense"],
    });
    expect(group).toContainElement(expense);
    expect(expense).toBeChecked();
    expect(expense).toHaveAccessibleDescription(
      catalogEn["entry.kindHint.expense"],
    );
    expect(
      screen.getByRole("radio", { name: catalogEn["entry.kind.advanced"] }),
    ).toHaveAccessibleDescription(catalogEn["entry.kindHint.advanced"]);
    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["entry.kind.income"] }),
    );
    expect(chosen).toEqual(["income"]);
  });
});
