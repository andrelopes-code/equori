import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderWithProviders } from "@/testing/render-app";

import { ReturnGrowthBar } from "@/features/portfolio/return-money/return-growth-bar";

describe("ReturnGrowthBar", () => {
  it("sizes each segment by its amount and states both in the legend", async () => {
    const { container } = renderBar();

    await screen.findByText("R$1,000.00");

    const deposits = segment(container, "deposits");
    const gain = segment(container, "gain");

    expect(deposits.style.flexGrow).toBe("100000");
    expect(gain.style.flexGrow).toBe("5000");
    expect(legend(container, "deposits").textContent).toBe(
      `${catalogEn["return.money.deposits"]}R$1,000.00`,
    );
    expect(legend(container, "gain").textContent).toBe(
      `${catalogEn["return.money.gain"]}R$50.00`,
    );
  });

  it("hides the bar from assistive technology and keeps the heading", async () => {
    const { container } = renderBar();

    await screen.findByText("R$1,000.00");

    const bar = segment(container, "deposits").parentElement;

    expect(bar?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText(catalogEn["return.growth.title"])).toBeTruthy();
  });

  it("masks both amounts in privacy mode", async () => {
    localStorage.setItem("equori.privacy", "hidden");

    try {
      const { container } = renderBar();

      await screen.findByText(catalogEn["return.growth.title"]);

      expect(container.textContent).not.toMatch(/\d/u);
    } finally {
      localStorage.removeItem("equori.privacy");
    }
  });
});

function renderBar() {
  return renderWithProviders(
    <ReturnGrowthBar deposits={100000} gain={5000} currency="BRL" />,
    { fetch: portfolioApi() },
  );
}

function segment(container: HTMLElement, key: string): HTMLElement {
  return queryOrThrow(container, `[data-segment="${key}"]`);
}

function legend(container: HTMLElement, key: string): HTMLElement {
  return queryOrThrow(container, `[data-legend="${key}"]`);
}

function queryOrThrow(container: HTMLElement, selector: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`no element matches ${selector}`);

  return element;
}
