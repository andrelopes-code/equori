import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountYield } from "@/features/portfolio/account-yield";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

const line = vi.hoisted(() => ({ negative: false }));

vi.mock("@/features/portfolio/use-account-yield", () => ({
  useAccountYield: () => ({}),
}));

vi.mock("@/features/portfolio/yield-figures", () => ({
  yieldLine: () => ({ primary: "FIGURE", negative: line.negative }),
}));

function figureTone(): string {
  return screen.getByText("FIGURE").getAttribute("data-tone") ?? "inherit";
}

describe("AccountYield", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["a positive yield", false, "success"],
    ["a negative yield", true, "danger"],
  ] as const)("reads %s", (_name, negative, tone) => {
    line.negative = negative;
    renderWithProviders(<AccountYield accountId="a" date="2026-10-01" />, {
      fetch: fakeApi({}),
    });

    expect(figureTone()).toBe(tone);
  });

  it("keeps the text's own tone when the amounts are hidden", () => {
    hideAmounts();
    line.negative = false;
    renderWithProviders(<AccountYield accountId="a" date="2026-10-01" />, {
      fetch: fakeApi({}),
    });

    expect(figureTone()).toBe("inherit");
  });
});
