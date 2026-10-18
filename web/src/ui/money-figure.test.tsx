import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/locale";
import { MoneyFigure } from "@/ui/money-figure";

function parts(locale: Locale, amount: number, currency: string) {
  const { container } = render(
    <I18nProvider locale={locale}>
      <MoneyFigure money={{ amount, currency }} scale={2} size="lg" />
    </I18nProvider>,
  );
  const figure = container.querySelector('[data-own="money-figure"]');
  return {
    spoken: figure?.querySelector('[data-ui="visually-hidden"]')?.textContent,
    parts: [...(figure?.querySelectorAll("[data-figure-part]") ?? [])].map(
      (node) => [node.getAttribute("data-figure-part"), node.textContent],
    ),
  };
}

// Ledger sheet decision L10.
describe("MoneyFigure", () => {
  it("recesses the symbol and the cents in pt-BR", () => {
    expect(parts("pt-BR", -5300, "BRL")).toEqual({
      spoken: "\u2212R$\u00a053,00",
      parts: [
        ["sign", "−"],
        ["symbol", "R$"],
        ["integer", "53"],
        ["fraction", ",00"],
      ],
    });
  });

  it("recesses the symbol and the cents in en", () => {
    expect(parts("en", 452180, "USD").parts).toEqual([
      ["symbol", "$"],
      ["integer", "4,521"],
      ["fraction", ".80"],
    ]);
  });
});
