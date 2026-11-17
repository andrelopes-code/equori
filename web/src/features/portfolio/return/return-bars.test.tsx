import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";
import { fakeApi } from "@/testing/fake-api";
import { marketReturn, plainReturn } from "@/testing/portfolio-api";
import { renderWithProviders } from "@/testing/render-app";

import { ReturnBars } from "@/features/portfolio/return/return-bars";
import { returnSummary } from "@/features/portfolio/model/return-summary";

type ReturnReport = components["schemas"]["ReturnReport"];

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const market: ReturnReport = {
  ...plainReturn,
  profile: "market",
  period_bp: marketReturn.period_bp,
  benchmark: {
    ...marketReturn.benchmark,
    started_late: false,
    credits: 0,
    restarted: false,
    skipped: 0,
  },
  inflation: marketReturn.inflation,
};

const pairNames = [
  "Portfolio −10.00%, CDI 0.33%",
  "Portfolio 0.00%, IPCA 0.90%",
] as const;

function renderBars() {
  const summary = returnSummary(market, "portfolio", t, "en");
  if (summary.axis === undefined) throw new Error("the summary has no axis");

  return renderWithProviders(
    <ReturnBars comparisons={summary.comparisons} axis={summary.axis} />,
    { fetch: fakeApi({}) },
  );
}

function bar(pair: HTMLElement, key: string): HTMLElement {
  const found = pair.querySelector<HTMLElement>(`[data-bar="${key}"]`);
  if (found === null) throw new Error(`no bar ${key}`);

  return found;
}

describe("ReturnBars", () => {
  it("names each pair of bars by its two values", () => {
    renderBars();

    const names = screen.getAllByRole("img").map((img) => {
      return img.getAttribute("aria-label");
    });

    expect(names).toEqual(pairNames);
  });

  it("writes the ticks of the shared axis under the last block", () => {
    renderBars();

    for (const tick of ["−16%", "−8%", "0%", "8%"]) {
      expect(screen.getByText(tick)).toBeInTheDocument();
    }
  });

  it("writes the heading, the window and the chip of each block", () => {
    renderBars();

    expect(screen.getByText("Against the CDI")).toBeInTheDocument();
    expect(screen.getByText("Against inflation")).toBeInTheDocument();
    expect(screen.getByText("−10.33 pp")).toBeInTheDocument();
    expect(screen.getByText("−0.89% real")).toBeInTheDocument();
  });

  it("writes the value of each bar beside it", () => {
    renderBars();

    const pair = screen.getByRole("img", { name: pairNames[0] });

    expect(within(pair).getByText("−10.00%")).toBeInTheDocument();
    expect(within(pair).getByText("0.33%")).toBeInTheDocument();
  });

  it("draws a negative bar left of the zero line", () => {
    renderBars();

    const pair = screen.getByRole("img", { name: pairNames[0] });
    const zero = (1600 * 100) / 2400;
    const size = (1000 * 100) / 2400;
    const style = bar(pair, "subject").style;

    expect(style.inlineSize).toBe(`${String(size)}%`);
    expect(style.insetInlineStart).toBe(`${String(zero - size)}%`);
  });

  // RK5: the axis runs from −1600 to 800, so the zero line sits at 1600 of 2400.
  it("writes the value of a negative bar after the zero line", () => {
    renderBars();

    const pair = screen.getByRole("img", { name: pairNames[0] });
    const style = within(pair).getByText("−10.00%").style;

    expect(style.insetInlineStart).toBe(`${String((1600 * 100) / 2400)}%`);
    expect(style.insetInlineEnd).toBe("");
  });

  it("draws a positive bar from the zero line", () => {
    renderBars();

    const pair = screen.getByRole("img", { name: pairNames[0] });
    const style = bar(pair, "index").style;

    expect(style.inlineSize).toBe(`${String((33 * 100) / 2400)}%`);
    expect(style.insetInlineStart).toBe(`${String((1600 * 100) / 2400)}%`);
  });

  it("draws a zero bar with no length", () => {
    renderBars();

    const pair = screen.getByRole("img", { name: pairNames[1] });

    expect(bar(pair, "subject").style.inlineSize).toBe("0%");
  });
});
