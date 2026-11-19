import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DebtAnswer } from "@/features/calculators/debt-payoff-calculator/debt-answer";
import { DebtAnswerView } from "@/features/calculators/debt-payoff-calculator/debt-answer-view";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const money: CalculatorMoney = {
  currency: "BRL",
  scale: 2,
  format: (minor) => `${String(minor)} minor`,
};

// The snowball pays 700 of interest in 10 months, the avalanche 1000 in 14: the saving is 300.
// No debt input reaches this state, since the avalanche pays the least interest; the view still
// states it from an answer that holds it.
const snowballLess: DebtAnswer = {
  kind: "solved",
  cheaper: "snowball",
  saving: 300,
  avalanche: { months: 14, interest: 1000, closed: [] },
  snowball: { months: 10, interest: 700, closed: [] },
};

describe("DebtAnswerView", () => {
  it("names the snowball order and states the difference when it pays less", async () => {
    renderWithProviders(
      <DebtAnswerView money={money} answer={snowballLess} missing={[]} />,
      { fetch: fakeApi(calculatorApiRoutes()) },
    );

    expect(
      await screen.findByText("Snowball pays less interest"),
    ).toBeVisible();
    expect(screen.getByText("300 minor")).toBeVisible();
    expect(
      screen.getByText(
        "less than avalanche, with the last payment in 14 months.",
      ),
    ).toBeVisible();
  });
});
