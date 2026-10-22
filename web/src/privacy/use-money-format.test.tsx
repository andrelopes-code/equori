import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { PrivacyProvider } from "@/privacy/privacy-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale={{ language: "pt", region: "BR" }}>
      <PrivacyProvider>{children}</PrivacyProvider>
    </I18nProvider>
  );
}

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("useMoneyFormat", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("formats like the locale while visible", () => {
    const { result } = renderHook(() => useMoneyFormat(), { wrapper });
    expect(result.current.hidden).toBe(false);
    expect(result.current.money(brl(123456), 2)).toBe("R$ 1.234,56");
    expect(result.current.signed(brl(500), 2)).toBe("+R$ 5,00");
    expect(result.current.parts(brl(-123456), 2).integer).toBe("1.234");
  });

  it("writes the mask in place of every form of the amount while hidden", () => {
    localStorage.setItem("equori.privacy", "hidden");
    const { result } = renderHook(() => useMoneyFormat(), { wrapper });
    expect(result.current.hidden).toBe(true);
    expect(result.current.money(brl(123456), 2)).toBe(`R$ ${MASK}`);
    expect(result.current.money(brl(-123456), 2)).toBe(`R$ ${MASK}`);
    expect(result.current.signed(brl(500), 2)).toBe(`R$ ${MASK}`);
    expect(result.current.parts(brl(123456), 2).integer).toBe(MASK);
  });

  it("keeps the amount in an entry field readable while hidden", () => {
    localStorage.setItem("equori.privacy", "hidden");
    const { result } = renderHook(() => useMoneyFormat(), { wrapper });
    const entry = result.current.entry(brl(123456), 2);
    expect(entry.integer + entry.fraction).toBe("1.234,56");
  });

  it("keeps the object identity while locale and hidden are unchanged", () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useMoneyFormat());
      return null;
    }
    const { rerender } = render(<Probe />, { wrapper });
    rerender(<Probe />);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe(seen[0]);
  });
});
