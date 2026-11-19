import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";

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

function renderGroups(search: Record<string, string>) {
  address.initial = search;

  return render(
    <OptionalGroups
      groups={[
        {
          keys: ["delay"],
          add: "Add delay",
          legend: "Delay",
          remove: "Remove delay",
          children: <p>delay fields</p>,
        },
        {
          keys: ["withdraw", "withdrawUnit"],
          add: "Add withdrawal",
          legend: "Withdrawal",
          remove: "Remove withdrawal",
          children: <p>withdraw fields</p>,
        },
      ]}
    />,
  );
}

describe("OptionalGroups", () => {
  it("draws the add buttons of the closed groups in one row", () => {
    renderGroups({});

    const delay = screen.getByRole("button", { name: "Add delay" });
    const withdraw = screen.getByRole("button", { name: "Add withdrawal" });

    expect(delay.parentElement).toBe(withdraw.parentElement);
    expect(screen.queryByText("delay fields")).toBeNull();
  });

  it("opens one group and keeps the other's button", async () => {
    renderGroups({});

    await userEvent.click(screen.getByRole("button", { name: "Add delay" }));

    expect(screen.getByText("delay fields")).toBeVisible();
    expect(screen.getByText("Delay")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add delay" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add withdrawal" }),
    ).toBeVisible();
  });

  it("opens a group whose key is in the address", () => {
    renderGroups({ withdrawUnit: "month" });

    expect(screen.getByText("withdraw fields")).toBeVisible();
    expect(screen.queryByText("delay fields")).toBeNull();
  });

  it("removes the keys of one group and closes only it", async () => {
    renderGroups({ delay: "12", withdraw: "10", withdrawUnit: "month" });

    await userEvent.click(
      screen.getByRole("button", { name: "Remove withdrawal" }),
    );

    expect(screen.queryByText("withdraw fields")).toBeNull();
    expect(screen.getByText("delay fields")).toBeVisible();
    expect(address.current).toEqual({ delay: "12" });
    expect(
      screen.getByRole("button", { name: "Add withdrawal" }),
    ).toBeVisible();
  });
});
