import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";

// The address of a calculator route, held in state: the route itself needs the whole application.
const address = vi.hoisted(() => {
  const empty: Record<string, string> = {};

  // deferred: the router commits a navigation after the render that asked for it.
  return { initial: empty, current: empty, deferred: false };
});

vi.mock("@/features/calculators/model/calculator-search", () => ({
  useCalculatorSearch: () => {
    const [search, setSearch] = useState(address.initial);
    address.current = search;

    return [
      search,
      (patch: Record<string, string | undefined>) => {
        const apply = () => {
          setSearch((prev) =>
            Object.fromEntries(
              Object.entries({ ...prev, ...patch }).filter(
                (entry): entry is [string, string] => entry[1] !== undefined,
              ),
            ),
          );
        };

        if (address.deferred) setTimeout(apply, 0);
        else apply();
      },
    ];
  },
}));

const addressKeys = ["delay", "withdraw", "withdrawUnit"] as const;

function renderGroups(search: Record<string, string>, deferred = false) {
  address.initial = search;
  address.deferred = deferred;

  return render(
    <OptionalGroups
      addressKeys={addressKeys}
      groups={[
        {
          keys: ["delay"],
          add: "Add delay",
          legend: "Delay",
          remove: "Remove delay",
          children: <input aria-label="Delay months" />,
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
    expect(screen.queryByLabelText("Delay months")).toBeNull();
  });

  it("opens one group and keeps the other's button", async () => {
    renderGroups({});

    await userEvent.click(screen.getByRole("button", { name: "Add delay" }));

    expect(screen.getByLabelText("Delay months")).toBeVisible();
    expect(screen.getByText("Delay")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add delay" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add withdrawal" }),
    ).toBeVisible();
  });

  it("opens a group whose key is in the address", () => {
    renderGroups({ withdrawUnit: "month" });

    expect(screen.getByText("withdraw fields")).toBeVisible();
    expect(screen.queryByLabelText("Delay months")).toBeNull();
  });

  it("removes the keys of one group and closes only it", async () => {
    renderGroups({ delay: "12", withdraw: "10", withdrawUnit: "month" });

    await userEvent.click(
      screen.getByRole("button", { name: "Remove withdrawal" }),
    );

    expect(screen.queryByText("withdraw fields")).toBeNull();
    expect(screen.getByLabelText("Delay months")).toBeVisible();
    expect(address.current).toEqual({ delay: "12" });
    expect(
      screen.getByRole("button", { name: "Add withdrawal" }),
    ).toBeVisible();
  });

  it("moves focus to the first control of the group that opens", async () => {
    renderGroups({});

    await userEvent.click(screen.getByRole("button", { name: "Add delay" }));

    expect(screen.getByLabelText("Delay months")).toHaveFocus();
  });

  it("moves focus to the add button of the group that closes", async () => {
    renderGroups({ delay: "12" });

    await userEvent.click(screen.getByRole("button", { name: "Remove delay" }));

    expect(screen.getByRole("button", { name: "Add delay" })).toHaveFocus();
  });

  it("moves focus to the add button once the router commits the removal", async () => {
    renderGroups({ delay: "12" }, true);

    await userEvent.click(screen.getByRole("button", { name: "Remove delay" }));

    const add = await screen.findByRole("button", { name: "Add delay" });
    expect(add).toHaveFocus();
  });

  it("keeps focus where it is when the address opens a group", () => {
    renderGroups({ delay: "12" });

    expect(document.body).toHaveFocus();
  });

  it("does not compile a key the address does not declare", () => {
    const element = (
      <OptionalGroups
        addressKeys={addressKeys}
        groups={[
          {
            // @ts-expect-error "delai" is not in addressKeys.
            keys: ["delai"],
            add: "a",
            legend: "l",
            remove: "r",
            children: null,
          },
        ]}
      />
    );

    expect(element).toBeDefined();
  });
});
