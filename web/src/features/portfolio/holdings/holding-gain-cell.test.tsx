import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { HoldingGainCell } from "@/features/portfolio/holdings/holding-gain-cell";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

function holding(gain: number): Holding {
  return { gain, gainBp: undefined, mixed: false } as Holding;
}

function gainTone(): string {
  return screen.getByText(/\d/).getAttribute("data-tone") ?? "inherit";
}

describe("HoldingGainCell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["a gain", 500, "success"],
    ["a loss", -500, "danger"],
  ] as const)("reads %s", (_name, gain, tone) => {
    renderWithProviders(
      <HoldingGainCell holding={holding(gain)} valueIn="BRL" />,
      {
        fetch: fakeApi({}),
      },
    );

    expect(gainTone()).toBe(tone);
  });

  it("keeps the text's own tone when the amounts are hidden", () => {
    hideAmounts();
    renderWithProviders(
      <HoldingGainCell holding={holding(500)} valueIn="BRL" />,
      {
        fetch: fakeApi({}),
      },
    );

    expect(screen.getByText(/••••/).getAttribute("data-tone")).toBeNull();
  });
});
