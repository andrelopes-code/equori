import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PositionState } from "@/features/reports/indicator-series";
import { RangeStrip } from "@/features/reports/range-strip";
import { I18nProvider } from "@/i18n/i18n-provider";

type Strip = Extract<PositionState, { kind: "strip" }>;

const savings: Strip = {
  kind: "strip",
  min: -500,
  max: 2500,
  dots: [
    { index: 3, bp: 1000 },
    { index: 4, bp: -500 },
    { index: 5, bp: 2500 },
  ],
  band: [-500, 2500],
  flat: false,
  current: 800,
  markerHidden: false,
  mean: 1200,
};

describe("RangeStrip", () => {
  it("names the value, the other months and the mean", () => {
    renderStrip(savings);

    expect(
      screen.getByRole("img", {
        name: "Savings rate: 8.00%. Other months from -5.00% to 25.00%, 12-month mean 12.00%.",
      }),
    ).toBeInTheDocument();
  });

  it("names a partial month", () => {
    renderStrip({ ...savings, markerHidden: true });

    expect(
      screen.getByRole("img", {
        name: "Savings rate: 8.00%, partial. Other months from -5.00% to 25.00%, 12-month mean 12.00%.",
      }),
    ).toBeInTheDocument();
  });

  it("names a row with no mean", () => {
    renderStrip({ ...savings, mean: null });

    expect(
      screen.getByRole("img", {
        name: "Savings rate: 8.00%. Other months from -5.00% to 25.00%.",
      }),
    ).toBeInTheDocument();
  });

  it("writes the ends, the zero and the mean", () => {
    renderStrip(savings);

    expect(screen.getByText("-5.00%")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();
    expect(screen.getByText("0.00%")).toBeInTheDocument();
    expect(screen.getByText("12-month mean 12.00%")).toBeInTheDocument();
  });

  it("places the asked month by its share of the extent", () => {
    const { container } = renderStrip(savings);

    // (800 - -500) / (2500 - -500) = 43.33 %
    expect(container.querySelector("[data-asked]")).toHaveAttribute(
      "style",
      "--at: 43.33%;",
    );
  });

  it("draws no asked month while it is incomplete", () => {
    const { container } = renderStrip({ ...savings, markerHidden: true });

    expect(container.querySelector("[data-asked]")).toBeNull();
  });

  it("writes a flat band once, without its ends", () => {
    renderStrip({
      ...savings,
      min: 0,
      max: 1744,
      band: [0, 0],
      flat: true,
      current: 1744,
      mean: null,
    });

    expect(screen.getByText("0.00% in every other month")).toBeInTheDocument();
    expect(screen.queryByText("17.44%")).not.toBeInTheDocument();
    expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
  });
});

function renderStrip(state: Strip) {
  return render(
    <I18nProvider locale={{ language: "en", region: "US" }}>
      <RangeStrip
        title="Savings rate"
        value={state.current}
        state={state}
        format={(bp) => `${(bp / 100).toFixed(2)}%`}
      />
    </I18nProvider>,
  );
}
