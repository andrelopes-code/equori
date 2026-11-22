import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AccountMark,
  monogram,
} from "@/features/accounts/account-mark/account-mark";

describe("monogram", () => {
  it.each([
    ["Mercado Pago", "MP"],
    ["Nubank", "NU"],
    ["  banco   do brasil ", "BD"],
    ["C6", "C6"],
    ["Itaú - Visa", "IV"],
    ["", ""],
  ])("%s → %s", (name, want) => {
    expect(monogram(name)).toBe(want);
  });
});

describe("AccountMark", () => {
  it("draws the monogram when there is no logo, hidden from assistive technology", () => {
    const { container } = render(
      <AccountMark shape="square" name="Mercado Pago" color={3} />,
    );
    const mark = container.firstElementChild;
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.getAttribute("data-shape")).toBe("square");
    expect(mark?.getAttribute("data-color")).toBe("3");
    expect(mark?.textContent).toBe("MP");
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws the logo in place of the monogram", () => {
    const { container } = render(
      <AccountMark shape="circle" name="Nubank" logo="/assets/nu.png" />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/assets/nu.png",
    );
    expect(container.textContent).toBe("");
  });

  it("holds a placeholder over the logo until the image loads", () => {
    const { container } = render(
      <AccountMark shape="square" name="Nubank" logo="/assets/nu.png" />,
    );
    const placeholder = () => container.querySelector("[data-ui-skeleton]");
    expect(placeholder()?.hasAttribute("data-loading")).toBe(true);

    fireEvent.load(imageOf(container));

    expect(placeholder()?.hasAttribute("data-loading")).toBe(false);
  });

  it("holds the placeholder, not the monogram, while the logo is still being resolved", () => {
    const { container } = render(
      <AccountMark shape="square" name="Nubank" logoPending />,
    );

    expect(
      container
        .querySelector("[data-ui-skeleton]")
        ?.hasAttribute("data-loading"),
    ).toBe(true);
    expect(container.textContent).toBe("");
  });

  it("withdraws the placeholder when the image fails", () => {
    const { container } = render(
      <AccountMark shape="square" name="Nubank" logo="/assets/nu.png" />,
    );

    fireEvent.error(imageOf(container));

    expect(
      container
        .querySelector("[data-ui-skeleton]")
        ?.hasAttribute("data-loading"),
    ).toBe(false);
  });

  it("badges a card's plate", () => {
    const { container } = render(
      <AccountMark shape="card" name="Itaú" size="lg" />,
    );
    const mark = container.firstElementChild;
    expect(mark?.childElementCount).toBe(2);
    expect(mark?.textContent).toBe("IT");
  });

  it("rings a reserve with its goal's progress, clamped to 100 %", () => {
    const { container, rerender } = render(
      <AccountMark shape="circle" name="Viagem" progress={4250} />,
    );
    const mark = container.firstElementChild as HTMLElement;
    const arc = () => container.querySelector("circle[stroke-dasharray]");
    expect(mark.getAttribute("data-ring")).toBe("true");
    expect(arc()?.getAttribute("stroke-dasharray")).toBe("42.5 100");
    rerender(<AccountMark shape="circle" name="Viagem" progress={12000} />);
    expect(arc()?.getAttribute("stroke-dasharray")).toBe("100 100");
    rerender(<AccountMark shape="circle" name="Viagem" progress={0} />);
    expect(arc()).toBeNull();
  });

  it("draws no ring outside a circle", () => {
    const { container } = render(
      <AccountMark shape="square" name="Nubank" progress={5000} />,
    );
    expect(container.firstElementChild?.hasAttribute("data-ring")).toBe(false);
  });

  it("marks an unavailable account", () => {
    const { container } = render(
      <AccountMark shape="card" name="Inter" disabled />,
    );
    expect(container.firstElementChild?.getAttribute("data-disabled")).toBe(
      "true",
    );
  });
});

function imageOf(container: HTMLElement): HTMLImageElement {
  const img = container.querySelector("img");
  if (img === null) throw new Error("no image drawn");

  return img;
}
