import { render, screen } from "@testing-library/react";
import { StatCard, StatCardFigure } from "@slotted/react/stat-card";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { PrivacyProvider } from "@/privacy/privacy-provider";
import { hideAmounts } from "@/testing/privacy";
import { MoneyValue } from "@/ui/money-value";

function inPtBR(ui: ReactNode) {
  return render(
    <I18nProvider locale={{ language: "pt", region: "BR" }}>
      <PrivacyProvider>{ui}</PrivacyProvider>
    </I18nProvider>,
  );
}

function renderValue(
  money: { amount: number; currency: string },
  scale = 2,
  signed = false,
) {
  return inPtBR(
    <StatCard aria-label="figure">
      <StatCardFigure>
        <MoneyValue money={money} scale={scale} signed={signed} />
      </StatCardFigure>
    </StatCard>,
  );
}

const units = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-part-unit]")].map(
    (el) => el.textContent,
  );

const valueText = (container: HTMLElement) =>
  container.querySelector("[data-part-value]")?.textContent;

describe("MoneyValue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("draws the symbol and the minor digits as the unit and the whole units as the value", () => {
    const { container } = renderValue({ amount: 199988, currency: "BRL" });
    expect(units(container)).toEqual(["R$", ",88"]);
    expect(valueText(container)).toBe("R$ 1.999,88");
  });

  it("writes the minus sign of the application against the digits, outside the unit", () => {
    const { container } = renderValue({ amount: -5300, currency: "BRL" });
    expect(valueText(container)).toBe("R$ −53,00");
    expect(units(container)).toEqual(["R$", ",00"]);
  });

  it("writes a leading plus against the digits for a signed positive amount", () => {
    const { container } = renderValue(
      { amount: 500, currency: "BRL" },
      2,
      true,
    );
    expect(valueText(container)).toBe("R$ +5,00");
  });

  it("draws no minor digits at scale 0", () => {
    const { container } = renderValue({ amount: 1500, currency: "JPY" }, 0);
    expect(units(container)).toEqual(["JP¥"]);
  });

  it("keeps the symbol and masks the digits while the amounts are hidden", () => {
    hideAmounts();
    const { container } = renderValue({ amount: 199988, currency: "BRL" });
    expect(units(container)).toEqual(["R$"]);
    expect(valueText(container)).toBe("R$\u00a0" + MASK);
    expect(screen.queryByText(/1\.999/)).toBeNull();
  });

  it("writes no plus while the amounts are hidden", () => {
    hideAmounts();
    const { container } = renderValue(
      { amount: 500, currency: "BRL" },
      2,
      true,
    );
    expect(valueText(container)).toBe("R$\u00a0" + MASK);
  });
});
