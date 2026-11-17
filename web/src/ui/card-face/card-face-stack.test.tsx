import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/testing/render-app";
import { CardFaceStack } from "@/ui/card-face/card-face-stack";

function faces(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const position = String(index + 1);

    return {
      id: `card-${position}`,
      face: {
        title: `Card ${position}`,
        holder: "Ana Souza",
        lastFour: position.padStart(4, "0"),
      },
    };
  });
}

function stack(count: number, selected: string, onSelect = vi.fn()) {
  renderWithProviders(
    <CardFaceStack
      faces={faces(count)}
      selected={selected}
      onSelect={onSelect}
      label="Cards of the account"
    />,
    { fetch: vi.fn<typeof fetch>() },
  );

  return onSelect;
}

describe("CardFaceStack", () => {
  it("draws one face as one pressed button", () => {
    stack(1, "card-1");

    const buttons = screen.getAllByRole("button");

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
  });

  it("draws the selected face last and presses only it", () => {
    stack(5, "card-2");

    const buttons = screen.getAllByRole("button");
    const pressed = buttons.filter(
      (button) => button.getAttribute("aria-pressed") === "true",
    );

    expect(buttons).toHaveLength(5);
    expect(pressed).toHaveLength(1);
    expect(buttons.at(-1)).toBe(pressed[0]);
    expect(pressed[0]?.getAttribute("aria-label")).toBe("Card 2, ending 0002");
  });

  it("calls onSelect with the id of a clicked unselected face", async () => {
    const onSelect = stack(3, "card-3");

    await userEvent.click(screen.getByRole("button", { name: /Card 1/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("card-1");
  });

  it("calls onSelect with the id of an unselected face on Enter", async () => {
    const onSelect = stack(3, "card-3");

    screen.getByRole("button", { name: /Card 2/ }).focus();
    await userEvent.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("card-2");
  });

  it("draws ten faces as ten buttons", () => {
    stack(10, "card-4");

    expect(screen.getAllByRole("button")).toHaveLength(10);
  });

  it("names the group with the label", () => {
    stack(2, "card-1");

    expect(
      screen.getByRole("group", { name: "Cards of the account" }),
    ).toBeTruthy();
  });
});
