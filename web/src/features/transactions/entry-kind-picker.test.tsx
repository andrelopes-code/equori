import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { EntryKind } from "@/features/transactions/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import { catalogEn } from "@/i18n/catalog.en";
import { chooseEntryKind } from "@/testing/entry-kind";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

// docs/contributing/forms.md, F13: the frequent kinds are segments, the others a menu.
describe("EntryKindPicker", () => {
  it("offers the frequent kinds as segments and reports the choice", async () => {
    const chosen: EntryKind[] = [];
    renderWithProviders(
      <EntryKindPicker
        value="expense"
        investments
        onChange={(kind) => chosen.push(kind)}
      />,
      { fetch: fakeApi({}) },
    );

    const user = userEvent.setup();
    const expense = screen.getByRole("radio", {
      name: catalogEn["entry.kind.expense"],
    });
    await user.click(
      screen.getByRole("radio", { name: catalogEn["entry.kind.income"] }),
    );

    expect(
      screen.getByRole("group", { name: catalogEn["entry.kind"] }),
    ).toContainElement(expense);
    expect(expense).toBeChecked();
    expect(chosen).toEqual(["income"]);
  });

  it("describes the other kinds in a menu and names the chosen one", async () => {
    const chosen: EntryKind[] = [];
    const { unmount } = renderWithProviders(
      <EntryKindPicker
        value="expense"
        investments
        onChange={(kind) => chosen.push(kind)}
      />,
      { fetch: fakeApi({}) },
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: catalogEn["entry.otherKinds"] }),
    );
    const trade = await screen.findByRole("menuitemradio", {
      name: catalogEn["entry.kind.trade"],
    });

    expect(trade).toHaveAccessibleDescription(
      catalogEn["entry.kindHint.trade"],
    );

    await user.click(trade);
    unmount();
    renderWithProviders(
      <EntryKindPicker value="trade" investments onChange={() => undefined} />,
      { fetch: fakeApi({}) },
    );

    expect(chosen).toEqual(["trade"]);
    expect(
      screen.getByRole("button", { name: catalogEn["entry.kind.trade"] }),
    ).toBeInTheDocument();
  });

  it("offers the advanced kind as a fourth segment when no investment kind is shown", async () => {
    const chosen: EntryKind[] = [];
    renderWithProviders(
      <EntryKindPicker
        value="expense"
        onChange={(kind) => chosen.push(kind)}
      />,
      { fetch: fakeApi({}) },
    );

    await chooseEntryKind(userEvent.setup(), catalogEn["entry.kind.advanced"]);

    expect(
      screen.queryByRole("button", { name: catalogEn["entry.otherKinds"] }),
    ).toBeNull();
    expect(chosen).toEqual(["advanced"]);
  });
});
