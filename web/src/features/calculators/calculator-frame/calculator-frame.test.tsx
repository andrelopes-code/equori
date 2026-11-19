import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: { to: string }) => <a href={to} {...props} />,
}));

function renderFrame(evidence?: React.ReactNode) {
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

function calcOf(): HTMLElement {
  const calc = screen.getByTestId("answer").parentElement;
  if (calc === null) throw new Error("the answer has no parent");

  return calc;
}
