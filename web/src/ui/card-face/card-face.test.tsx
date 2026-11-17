import { fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, renderWithRouter } from "@/testing/render-app";
import { CardFace } from "@/ui/card-face/card-face";

type Props = ComponentProps<typeof CardFace>;

const base: Props = {
  title: "Itaú Visa",
  institutionName: "Itaú",
  holder: "Ana Souza",
  lastFour: "4821",
};

function face(props: Partial<Props> = {}) {
  return renderWithProviders(<CardFace {...base} {...props} />, {
    fetch: vi.fn<typeof fetch>(),
  });
}

describe("CardFace", () => {
  it("names an active card with its title and digits", () => {
    face();

    const element = screen.getByRole("img", { name: "Itaú Visa, ending 4821" });

    expect(element.hasAttribute("data-inactive")).toBe(false);
  });

  it("names a virtual card and draws the Virtual tag", () => {
    face({ virtual: true });

    const element = screen.getByRole("img", {
      name: "Itaú Visa, ending 4821, virtual",
    });

    expect(within(element).getByText("Virtual")).toBeTruthy();
  });

  it("names an inactive card and marks it", () => {
    face({ active: false, virtual: true });

    const element = screen.getByRole("img", {
      name: "Itaú Visa, ending 4821, virtual, inactive",
    });

    expect(element.hasAttribute("data-inactive")).toBe(true);
    expect(within(element).getByText("Inactive")).toBeTruthy();
    expect(within(element).queryByText("Virtual")).toBeNull();
  });

  it("names a card without digits with its title alone", () => {
    renderWithProviders(<CardFace title="Itaú Visa" holder="Ana Souza" />, {
      fetch: vi.fn<typeof fetch>(),
    });

    expect(screen.getByRole("img", { name: "Itaú Visa" })).toBeTruthy();
  });

  it("is one link when link is set", () => {
    renderWithRouter(<CardFace {...base} link={{ to: "/cards" }} />, {
      path: "/",
      fetch: vi.fn<typeof fetch>(),
    });

    const link = screen.getByRole("link", { name: "Itaú Visa, ending 4821" });

    expect(link.getAttribute("href")).toBe("/cards");
  });

  it("is one button when onActivate is set", () => {
    const onActivate = vi.fn<() => void>();

    face({ onActivate, pressed: true });

    const button = screen.getByRole("button", {
      name: "Itaú Visa, ending 4821",
    });

    fireEvent.click(button);

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("draws a placeholder group while loading", () => {
    face({ loading: true });

    const group = screen.getByRole("group", { name: "Loading card" });

    expect(group).toBeTruthy();
    expect(screen.queryByText("Ana Souza")).toBeNull();
    expect(screen.queryByText("4821")).toBeNull();
  });

  it("sets the ink from the colour", () => {
    const yellow = face({ color: "#fce300" });

    expect(
      screen.getByRole("img", { name: /Itaú Visa/ }).getAttribute("data-ink"),
    ).toBe("dark");

    yellow.unmount();
    face();

    expect(
      screen.getByRole("img", { name: /Itaú Visa/ }).getAttribute("data-ink"),
    ).toBe("light");
  });

  it("draws the digits and the holder in the top row on peek", () => {
    face({ peek: true });

    const element = screen.getByRole("img", { name: /Itaú Visa/ });
    const top = element.querySelector("[data-part='top']");

    expect(top?.textContent).toContain("4821");
    expect(top?.textContent).toContain("Ana Souza");
    expect(top?.textContent).not.toContain("Itaú Visa");
  });

  it("draws no art and sets data-art plain for an unknown art", () => {
    face({ art: "nope" });

    const element = screen.getByRole("img", { name: /Itaú Visa/ });

    expect(element.getAttribute("data-art")).toBe("plain");
    expect(element.querySelector("[data-part='art'] svg")).toBeNull();
  });

  it.each(["waves", "orbits", "band", "contour", "dots", "carbon"])(
    "draws one hidden svg in the art slot for the art %s",
    (art) => {
      face({ art });

      const element = screen.getByRole("img", { name: /Itaú Visa/ });
      const drawings = element.querySelectorAll("[data-part='art'] svg");

      expect(element.getAttribute("data-art")).toBe(art);
      expect(drawings).toHaveLength(1);
      expect(drawings[0]?.getAttribute("aria-hidden")).toBe("true");
    },
  );

  it("draws the mark of the network as an image named by the network", () => {
    face({ network: "visa" });

    expect(screen.getByRole("img", { name: "Visa" })).toBeDefined();
  });

  it("draws no mark for an unknown network", () => {
    face({ network: "nope" });

    expect(screen.queryByRole("img", { name: "Visa" })).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});
