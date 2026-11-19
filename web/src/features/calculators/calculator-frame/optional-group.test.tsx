import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { OptionalGroup } from "@/features/calculators/calculator-frame/optional-group";

// The address of a calculator route, held in state: the route itself needs the whole application.
const address = vi.hoisted(() => {
  const empty: Record<string, string> = {};

  return { initial: empty, current: empty };
});

vi.mock("@/features/calculators/model/calculator-search", () => ({
  useCalculatorSearch: () => {
    const [search, setSearch] = useState(address.initial);
    address.current = search;

    return [
      search,
      (patch: Record<string, string | undefined>) => {
        setSearch((prev) =>
          Object.fromEntries(
            Object.entries({ ...prev, ...patch }).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          ),
        );
      },
    ];
  },
}));

function renderGroup(search: Record<string, string>) {
  address.initial = search;

  return render(
    <OptionalGroup
      keys={["prepayMonth", "prepayAmount"]}
      add="Add extra payment"
      legend="Extra payment"
      remove="Remove extra payment"
    >
      <p>fields</p>
    </OptionalGroup>,
  );
}

describe("OptionalGroup", () => {
  it("is closed without any of its keys in the address", () => {
    renderGroup({});

    expect(
      screen.getByRole("button", { name: "Add extra payment" }),
    ).toBeVisible();
    expect(screen.queryByText("fields")).toBeNull();
  });

  it("is open when a key is in the address", () => {
    renderGroup({ prepayMonth: "24" });

    expect(screen.getByText("fields")).toBeVisible();
    expect(screen.getByText("Extra payment")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Add extra payment" }),
    ).toBeNull();
  });

  it("opens by the add button", async () => {
    renderGroup({});

    await userEvent.click(
      screen.getByRole("button", { name: "Add extra payment" }),
    );

    expect(screen.getByText("fields")).toBeVisible();
  });

  it("removes every key from the address and closes", async () => {
    renderGroup({
      prepayMonth: "abc",
      prepayAmount: "2000000",
      months: "12",
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Remove extra payment" }),
    );

    expect(address.current).toEqual({ months: "12" });
    expect(
      screen.getByRole("button", { name: "Add extra payment" }),
    ).toBeVisible();
    expect(screen.queryByText("fields")).toBeNull();
  });

  it("closes a group opened by the add button when removed", async () => {
    renderGroup({});

    await userEvent.click(
      screen.getByRole("button", { name: "Add extra payment" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove extra payment" }),
    );

    expect(
      screen.getByRole("button", { name: "Add extra payment" }),
    ).toBeVisible();
  });
});
