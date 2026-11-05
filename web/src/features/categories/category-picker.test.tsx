import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryPicker } from "@/features/categories/category-picker";
import {
  readRecentCategories,
  rememberCategory,
} from "@/features/categories/recent-categories";
import { rememberDeviceUser } from "@/features/session";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const accounts = [
  { id: "checking", name: "Itaú", class: "asset", currency: "BRL" },
  { id: "food", name: "Food", class: "expense", currency: "BRL" },
  {
    id: "groceries",
    name: "Groceries",
    class: "expense",
    currency: "BRL",
    parent_id: "food",
    color: 2,
    icon: "shopping-cart",
  },
  {
    id: "old",
    name: "Old",
    class: "expense",
    currency: "BRL",
    closed_on: "2026-01-01",
  },
  { id: "salary", name: "Salary", class: "income", currency: "BRL" },
  {
    id: "unc",
    name: "Uncategorized expense",
    class: "expense",
    currency: "BRL",
    system_role: "uncategorized_expense",
  },
].map((a) => ({ opened_on: "2026-01-01", yield_mode: "none", ...a }));

function api(posted: unknown[] = []) {
  return fakeApi({
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "POST /api/v1/accounts": async (req) => {
      const body = (await req.json()) as Record<string, unknown>;
      posted.push(body);
      return json(201, {
        id: "pets",
        opened_on: "2026-10-17",
        yield_mode: "none",
        ...body,
      });
    },
  });
}

function Harness({
  onChange,
  amount,
  exclude,
}: {
  onChange: (id: string | null) => void;
  amount?: number;
  exclude?: ReadonlySet<string>;
}) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <CategoryPicker
      aria-label="Category"
      value={value}
      amount={amount ?? -1}
      {...(exclude === undefined ? {} : { exclude })}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
  rememberDeviceUser({ id: 1, email: "a@b.c", booksId: 1 });
});

describe("CategoryPicker", () => {
  it("offers open categories as paths and chooses one by keyboard", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />, { fetch: api() });
    const input = screen.getByRole("combobox", { name: "Category" });
    await userEvent.click(input);
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /Food › Groceries/ }),
      ).toBeInTheDocument();
    });
    // The mark is aria-hidden artwork; the option's words are the highlighted path.
    const names = screen
      .getAllByRole("option")
      .map((o) => o.querySelector('[data-ui="highlight"]')?.textContent);
    expect(names).toEqual(["Food", "Food › Groceries", "Salary"]);
    await userEvent.type(input, "groc");
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("groceries");
    expect(input).toHaveValue("Food › Groceries");
    expect(readRecentCategories()).toEqual(["groceries"]);
  });

  it("places each option in the media and label cells of the list grid", async () => {
    renderWithProviders(<Harness onChange={vi.fn()} />, { fetch: api() });
    await userEvent.click(screen.getByRole("combobox", { name: "Category" }));
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    // A bare child lands in the media column and pushes the offer to create
    // ("Create category") to the right by the width of the widest path.
    for (const option of screen.getAllByRole("option")) {
      expect(
        option.querySelector(':scope > [data-part="media"]'),
      ).not.toBeNull();
      expect(
        option.querySelector(
          ':scope > [data-part="label"] [data-ui="highlight"]',
        ),
      ).not.toBeNull();
    }
  });

  it("puts income first for a positive amount", async () => {
    renderWithProviders(<Harness onChange={vi.fn()} amount={500} />, {
      fetch: api(),
    });
    await userEvent.click(screen.getByRole("combobox", { name: "Category" }));
    await waitFor(() => {
      expect(screen.getAllByRole("option")[0]).toHaveTextContent("Salary");
    });
  });

  it("creates a category from the search under the class of the amount", async () => {
    const posted: unknown[] = [];
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />, {
      fetch: api(posted),
    });
    const input = screen.getByRole("combobox", { name: "Category" });
    await userEvent.click(input);
    await userEvent.type(input, "Pets");
    await userEvent.click(
      await screen.findByRole("option", { name: /Create category “Pets”/ }),
    );
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("pets");
    });
    expect(posted).toEqual([
      { name: "Pets", class: "expense", currency: "BRL" },
    ]);
  });

  it("offers no excluded category, among the recent ones either", async () => {
    rememberCategory("salary");
    rememberCategory("groceries");
    renderWithProviders(
      <Harness onChange={vi.fn()} exclude={new Set(["salary"])} />,
      { fetch: api() },
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Category" }));

    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });
    const names = screen
      .getAllByRole("option")
      .map((o) => o.querySelector('[data-ui="highlight"]')?.textContent);
    expect(names).not.toContain("Salary");
  });
});
