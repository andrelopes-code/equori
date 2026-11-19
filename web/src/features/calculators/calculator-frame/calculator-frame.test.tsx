import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: { to: string }) => <a href={to} {...props} />,
}));

type FrameProps = ComponentProps<typeof CalculatorFrame>;

function renderFrame(evidence?: React.ReactNode | null) {
  return renderWithProviders(
    <CalculatorFrame
      id="financing"
      answer={<section data-testid="answer" />}
      evidence={evidence}
      inputs={<p data-testid="inputs">inputs</p>}
      optional={<p data-testid="optional">optional</p>}
      details={<p data-testid="details">details</p>}
      method={<p data-testid="method">method</p>}
    />,
    { fetch: fakeApi({}) },
  );
}

describe("CalculatorFrame with an answer", () => {
  it("draws the answer, the evidence, the inputs with the optional inputs, then the details and the method", () => {
    const { container } = renderFrame(<p data-testid="evidence">evidence</p>);

    const calc = calcOf();
    const slot = (id: string) => screen.getByTestId(id);

    expect(container.querySelectorAll("[data-testid]")).toHaveLength(6);
    expect(calc.children).toHaveLength(4);
    expect(calc.children[0]).toBe(slot("answer"));
    expect(calc.children[1]).toContainElement(slot("evidence"));
    expect(calc.children[2]).toContainElement(slot("inputs"));
    expect(calc.children[2]).toContainElement(slot("optional"));
    expect(calc.children[3]).toContainElement(slot("details"));
    expect(calc.children[3]).toContainElement(slot("method"));
  });

  it("draws no evidence block without evidence", () => {
    renderFrame();

    const calc = calcOf();

    expect(calc.children).toHaveLength(3);
  });
});

describe("CalculatorFrame layout", () => {
  it("marks the grid when there is no evidence, so the inputs card starts at the first column", () => {
    renderFrame();

    expect(calcOf().className).toMatch(/noEvidence/);
  });

  it("marks the grid for a null evidence as for an absent one", () => {
    renderFrame(null);

    expect(calcOf().className).toMatch(/noEvidence/);
    expect(calcOf().children).toHaveLength(3);
  });

  it("leaves the grid unmarked with evidence", () => {
    renderFrame(<p>evidence</p>);

    expect(calcOf().className).not.toMatch(/noEvidence/);
  });
});

describe("CalculatorFrame without an answer", () => {
  it("draws the title and the unavailable message, with no inputs grid and no result region", () => {
    const { container } = renderWithProviders(
      <CalculatorFrame id="reserve" unavailable />,
      { fetch: fakeApi({}) },
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: catalogEn["calc.reserve.title"],
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(catalogEn["calc.unavailable"])).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["calc.unavailable.description"]),
    ).toBeInTheDocument();
    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(container.querySelector("[class*='work']")).toBeNull();
  });

  it("takes no results or options props, and requires an answer unless unavailable", () => {
    const withResults: FrameProps = {
      id: "reserve",
      unavailable: true,
      // @ts-expect-error results is not a prop
      results: null,
    };
    const withOptions: FrameProps = {
      id: "reserve",
      unavailable: true,
      // @ts-expect-error options is not a prop
      options: null,
    };
    // @ts-expect-error a frame that is not unavailable needs an answer
    const withoutAnswer: FrameProps = {
      id: "reserve",
      inputs: null,
      method: null,
    };

    expect([withResults, withOptions, withoutAnswer]).toHaveLength(3);
  });
});

function calcOf(): HTMLElement {
  const calc = screen.getByTestId("answer").parentElement;
  if (calc === null) throw new Error("the answer has no parent");

  return calc;
}
