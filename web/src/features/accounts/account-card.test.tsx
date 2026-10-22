import { screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { AccountCard } from "@/features/accounts/account-card";
import { renderWithProviders } from "@/testing/render-app";

type Props = ComponentProps<typeof AccountCard>;

const base: Props = {
  kind: "credit",
  color: "var(--slotted-data-1)",
  title: "Nubank Gold",
  institutionName: "Nubank",
  currency: "BRL",
  scale: 2,
  value: 184277,
  context: "due Nov 5",
  meter: { used: 8900, total: 10000 },
  signal: [1000, 0, 2500, 1500],
};

function card(props: Partial<Props> = {}) {
  renderWithProviders(<AccountCard {...base} {...props} />, {
    fetch: vi.fn<typeof fetch>(),
  });
  return screen.getByRole("group");
}

describe("AccountCard", () => {
  it("names the card with its kind, label, context and amount", () => {
    const face = card();
    expect(face.getAttribute("aria-label")).toBe(
      "Nubank Gold, credit, open statement · due Nov 5: R$1,842.77",
    );
    expect(face.textContent).toContain("Open statement · due Nov 5");
    expect(face.textContent).toContain("1,842");
    expect(face.textContent).toContain(".77");
  });

  it("draws the chip with its legend and sum, and the meter in alert with an icon", () => {
    const face = card();
    expect(
      within(face).getByRole("img", { name: "spent this week: R$50.00" }),
    ).toBeTruthy();
    const meter = within(face).getByRole("meter");
    expect(meter.getAttribute("aria-valuenow")).toBe("89");
    expect(meter.getAttribute("aria-valuetext")).toBe(
      "89% of the limit, R$11 free",
    );
    expect(meter.getAttribute("data-state")).toBe("alert");
    expect(meter.querySelector("[data-warning]")).not.toBeNull();
    expect(meter.querySelectorAll("[data-segment]")).toHaveLength(20);
    expect(meter.querySelectorAll("[data-segment='filled']")).toHaveLength(18);
    expect(meter.querySelectorAll("[data-segment='risk']")).toHaveLength(2);
  });

  it("states an exceeded limit in text and icon", () => {
    const meter = within(
      card({ meter: { used: 10400, total: 10000 } }),
    ).getByRole("meter");
    expect(meter.textContent).toContain("R$4 over the limit");
    expect(meter.textContent).toContain("104% of the limit");
    expect(meter.getAttribute("data-state")).toBe("over");
    expect(meter.querySelector("[data-warning]")).not.toBeNull();
  });

  it("hides amounts but keeps the percent and the meter", () => {
    const face = card({ hidden: true });
    expect(face.getAttribute("aria-label")).toBe(
      "Nubank Gold, credit, open statement · due Nov 5: hidden value",
    );
    expect(face.textContent).toContain("••••");
    expect(face.textContent).not.toContain("1,842");
    expect(face.textContent).not.toContain(".77");
    expect(face.textContent).toContain("R$ •••• free");
    expect(face.textContent).toContain("89% of the limit");
    expect(
      within(face).getByRole("img", { name: "spent this week: R$ ••••" }),
    ).toBeTruthy();
  });

  it("omits every element without data", () => {
    const face = card({
      value: undefined,
      context: undefined,
      meter: undefined,
      signal: [1200],
    });
    expect(face.getAttribute("aria-label")).toBe("Nubank Gold, credit");
    expect(within(face).queryByRole("meter")).toBeNull();
    expect(within(face).queryByRole("img")).toBeNull();
    expect(face.textContent).not.toContain("R$");
    expect(face.textContent).not.toContain("Open statement");
  });

  it("draws no meter for a total of zero", () => {
    expect(
      within(card({ meter: { used: 0, total: 0 } })).queryByRole("meter"),
    ).toBeNull();
  });

  it("puts the minus sign before the currency symbol", () => {
    const face = card({
      kind: "checking",
      value: -1050,
      context: undefined,
      meter: undefined,
    });
    expect(face.getAttribute("aria-label")).toBe(
      "Nubank Gold, account, available balance: −R$10.50",
    );
    expect(face.textContent).toContain("−R$");
  });

  it("marks a reached goal in text, without the warning icon", () => {
    const meter = within(
      card({
        kind: "savings",
        context: undefined,
        meter: { used: 21000, total: 20000 },
      }),
    ).getByRole("meter");
    expect(meter.textContent).toContain("Goal of R$200");
    expect(meter.textContent).toContain("Goal reached");
    expect(meter.getAttribute("data-state")).toBe("reached");
    expect(meter.querySelector("[data-warning]")).toBeNull();
  });

  it("is one link named by the card and described by its chip and meter", () => {
    renderWithProviders(<AccountCard {...base} href="/cards/a1" />, {
      fetch: vi.fn<typeof fetch>(),
    });
    const link = screen.getByRole("link", {
      name: "Nubank Gold, credit, open statement · due Nov 5: R$1,842.77",
    });
    expect(link.getAttribute("href")).toBe("/cards/a1");
    expect(link).toHaveAccessibleDescription(
      "spent this week: R$50.00; 89% of the limit, R$11 free",
    );
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("draws the logo on an opaque tile", () => {
    const face = card({ logo: "/assets/nu.png" });
    const img = face.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/assets/nu.png");
    expect(img?.parentElement?.hasAttribute("data-logo")).toBe(true);
  });

  it("draws placeholders and no amount while loading", () => {
    const face = card({ loading: true });
    expect(face.getAttribute("aria-label")).toBe("Loading account");
    expect(face.getAttribute("aria-busy")).toBe("true");
    expect(face.textContent).toBe("");
  });
});
