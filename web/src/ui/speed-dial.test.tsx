import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SpeedDial } from "@/ui/speed-dial";

function renderDial() {
  const selected: string[] = [];
  const actions = ["form", "text", "account"].map((id) => ({
    id,
    label: `Action ${id}`,
    icon: null,
    onSelect: () => {
      selected.push(id);
    },
  }));
  const view = render(
    <SpeedDial
      actions={actions}
      label="Create"
      closeLabel="Close menu"
      offset={80}
    />,
  );
  return { ...view, selected };
}

const fab = (name = "Create") => screen.getByRole("button", { name });
const items = () => screen.getAllByRole("menuitem", { hidden: true });
const root = () => document.querySelector("[data-own='speed-dial']");

describe("SpeedDial", () => {
  it("names the closed button and leaves the actions out of the tab order", () => {
    renderDial();
    expect(fab()).toHaveAttribute("aria-haspopup", "menu");
    expect(fab()).toHaveAttribute("aria-expanded", "false");
    expect(root()).toHaveAttribute("data-open", "false");
    expect(items().map((item) => item.getAttribute("tabindex"))).toEqual([
      "-1",
      "-1",
      "-1",
    ]);
  });

  it("orders the actions from the button upward and names each by its label", () => {
    renderDial();
    expect(items().map((item) => item.textContent)).toEqual([
      "Action form",
      "Action text",
      "Action account",
    ]);
  });

  it("opens on a press and renames the button to close", async () => {
    const user = userEvent.setup();
    renderDial();
    await user.click(fab());
    expect(fab("Close menu")).toHaveAttribute("aria-expanded", "true");
    expect(root()).toHaveAttribute("data-open", "true");
    expect(fab("Close menu")).toHaveFocus();
  });

  it("runs an action and closes", async () => {
    const user = userEvent.setup();
    const { selected } = renderDial();
    await user.click(fab());
    await user.click(screen.getByRole("menuitem", { name: "Action text" }));
    expect(selected).toEqual(["text"]);
    expect(fab()).toHaveAttribute("aria-expanded", "false");
    expect(fab()).toHaveFocus();
  });

  it("closes on a press of the scrim", async () => {
    const user = userEvent.setup();
    const { container } = renderDial();
    await user.click(fab());
    const scrim = document.querySelector(
      "[data-own='speed-dial'] > [aria-hidden]",
    );
    if (!(scrim instanceof HTMLElement)) throw new Error("no scrim");
    expect(container.contains(scrim)).toBe(false);
    await user.click(scrim);
    expect(fab()).toHaveAttribute("aria-expanded", "false");
  });

  it("moves focus to the first action when the keyboard opens it", async () => {
    const user = userEvent.setup();
    renderDial();
    act(() => {
      fab().focus();
    });
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Action form" })).toHaveFocus();
  });

  it("walks the actions with the arrows, Home and End", async () => {
    const user = userEvent.setup();
    renderDial();
    act(() => {
      fab().focus();
    });
    await user.keyboard("{Enter}");
    const name = () => document.activeElement?.textContent;
    await user.keyboard("{ArrowUp}");
    expect(name()).toBe("Action text");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(name()).toBe("Action account");
    await user.keyboard("{Home}");
    expect(name()).toBe("Action form");
    await user.keyboard("{End}");
    expect(name()).toBe("Action account");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(fab("Close menu")).toHaveFocus();
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    renderDial();
    act(() => {
      fab().focus();
    });
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(fab()).toHaveAttribute("aria-expanded", "false");
    expect(fab()).toHaveFocus();
  });

  it("closes on Tab", async () => {
    const user = userEvent.setup();
    renderDial();
    act(() => {
      fab().focus();
    });
    await user.keyboard("{Enter}");
    await user.tab();
    expect(fab()).toHaveAttribute("aria-expanded", "false");
  });

  it("gives each instance its own gradient and filter", () => {
    render(
      <>
        <SpeedDial actions={[]} label="A" closeLabel="x" offset={0} />
        <SpeedDial actions={[]} label="B" closeLabel="x" offset={0} />
      </>,
    );
    const ids = [...document.querySelectorAll("linearGradient, filter")].map(
      (node) => node.id,
    );
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});
