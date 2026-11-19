import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";

const facts = [
  { term: "Total pago", value: "R$ 1.023.197,89" },
  { term: "Juros", value: "R$ 723.197,89" },
  { term: "Juros a menos na SAC", value: "R$ 229.755,77" },
];

describe("CalculatorAnswer", () => {
  it("draws the lead, the figure, the sentence and the facts", () => {
    const { container } = render(
      <CalculatorAnswer
        lead="Prestação na tabela Price"
        figure="R$ 2.842,24"
        sentence="por 360 meses."
        facts={facts}
      />,
    );

    expect(screen.getByText("Prestação na tabela Price")).toBeVisible();
    expect(screen.getByText("R$ 2.842,24")).toBeVisible();
    expect(screen.getByText("por 360 meses.")).toBeVisible();
    expect(container.querySelectorAll("dt")).toHaveLength(3);
    expect(container.querySelectorAll("dd")).toHaveLength(3);
    const group = container.querySelectorAll("dl > div")[1] as HTMLElement;
    expect(within(group).getByText("Juros").tagName).toBe("DT");
    expect(within(group).getByText("R$ 723.197,89").tagName).toBe("DD");
  });

  it("draws a dash when the figure is null", () => {
    render(<CalculatorAnswer lead="a" figure={null} sentence="b" />);

    expect(screen.getByText("—")).toBeVisible();
  });

  it("carries the class answer on its root", () => {
    const { container } = render(
      <CalculatorAnswer lead="a" figure="1" sentence="b" />,
    );

    const root = container.firstElementChild as HTMLElement;

    // A CSS module class is _<name>_<hash>: the exact name, not answerLead.
    expect(root.className).toMatch(/^_answer_\w+$/);
  });

  it("announces a changed answer as one message", () => {
    render(<CalculatorAnswer lead="a" figure="1" sentence="b" />);

    const region = screen.getByRole("region");

    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });
});
