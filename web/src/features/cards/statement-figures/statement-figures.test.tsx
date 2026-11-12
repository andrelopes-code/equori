import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { StatementFigures } from "@/features/cards/statement-figures/statement-figures";
import { catalogEn } from "@/i18n/catalog.en";
import { MASK } from "@/privacy/mask";
import { money, statement } from "@/testing/account-api";
import { fakeApi } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

type Statement = components["schemas"]["StatementDetail"];

// The demo shape: R$ 1,326.09 owed before, R$ 336.90 charged, nothing credited or paid.
const demo = {
  opening: money(132609),
  charges: money(33690),
  amount_due: money(166299),
  unpaid: money(166299),
};

describe("StatementFigures", () => {
  it("writes the opening, the charges and the total, and no zero term", () => {
    renderFigures(demo);

    expect(termOf(catalogEn["statement.opening"])).toHaveTextContent(
      "R$1,326.09",
    );
    expect(termOf(catalogEn["statement.charges"])).toHaveTextContent(
      "R$336.90",
    );
    expect(termOf(catalogEn["statement.total"])).toHaveTextContent(
      "R$1,662.99",
    );
    expect(screen.queryByText(catalogEn["statement.credits"])).toBeNull();
    expect(screen.queryByText(catalogEn["statement.payments"])).toBeNull();
    expect(screen.getAllByText("+")).toHaveLength(1);
    expect(screen.getAllByText("=")).toHaveLength(1);
    expect(screen.queryByText("−")).toBeNull();
  });

  it("writes no open line when the unpaid amount is the total", () => {
    renderFigures(demo);

    expect(termOf(catalogEn["statement.total"])).toBeInTheDocument();
    expect(screen.queryByText(/^Open:/)).toBeNull();
  });

  it("writes no note of what a label means", () => {
    renderFigures(demo);

    expect(
      screen.queryByText("What the statement before left owed"),
    ).toBeNull();
    expect(screen.queryByText("Charged in this cycle")).toBeNull();
  });

  it("writes the five terms of a statement with credits and payments", () => {
    renderFigures({
      ...demo,
      credits: money(5000),
      payments: money(20000),
      amount_due: money(141299),
      unpaid: money(141299),
    });

    expect(termOf(catalogEn["statement.opening"])).toHaveTextContent(
      "R$1,326.09",
    );
    expect(termOf(catalogEn["statement.charges"])).toHaveTextContent(
      "R$336.90",
    );
    expect(termOf(catalogEn["statement.credits"])).toHaveTextContent("R$50.00");
    expect(termOf(catalogEn["statement.payments"])).toHaveTextContent(
      "R$200.00",
    );
    expect(termOf(catalogEn["statement.total"])).toHaveTextContent(
      "R$1,412.99",
    );
    expect(screen.getAllByText("+")).toHaveLength(1);
    expect(screen.getAllByText("−")).toHaveLength(2);
    expect(screen.getAllByText("=")).toHaveLength(1);
  });

  it("writes the open line with the unpaid note when a payment left a balance", () => {
    renderFigures({ ...demo, payments: money(20000), unpaid: money(146299) });

    const line = screen.getByText(
      "Open: R$1,462.99. What the payments after closing have not covered",
    );

    expect(line).toHaveAttribute("data-tone", "muted");
  });

  it("writes the minimum payment of the institution in the open line", () => {
    renderFigures({
      ...demo,
      payments: money(20000),
      unpaid: money(146299),
      institution: {
        source: "aggregator",
        due_date: "2026-10-25",
        total: money(166299),
        minimum: money(20000),
      },
      amount_difference: money(0),
    });

    expect(
      screen.getByText("Open: R$1,462.99. Minimum payment R$200.00"),
    ).toBeInTheDocument();
  });

  it("writes the open line of an overdue statement in the danger tone", () => {
    renderFigures({ ...demo, status: "overdue" });

    const line = screen.getByText("Open: R$1,662.99. Overdue since 10/25/2026");

    expect(line).toHaveAttribute("data-tone", "danger");
  });

  it("keeps the institution note under the line", () => {
    renderFigures({
      ...demo,
      institution: {
        source: "aggregator",
        due_date: "2026-10-25",
        total: money(170000),
        minimum: money(20000),
      },
      amount_difference: money(-3701),
    });

    expect(
      screen.getByText("Institution: R$1,700.00 (difference −R$37.01)"),
    ).toBeInTheDocument();
  });

  it("masks the figures and keeps the operators", () => {
    hideAmounts();
    const { container } = renderFigures({
      ...demo,
      credits: money(5000),
      payments: money(20000),
      unpaid: money(146299),
    });

    expectNoAmounts(container, ["1,326.09", "336.90", "1,662.99", "1,462.99"]);
    expect(screen.getAllByText(new RegExp(MASK)).length).toBeGreaterThanOrEqual(
      5,
    );
    expect(screen.getAllByText("+")).toHaveLength(1);
    expect(screen.getAllByText("−")).toHaveLength(2);
    expect(screen.getAllByText("=")).toHaveLength(1);
  });
});

function renderFigures(over: Record<string, unknown>) {
  const detail = {
    ...statement("s1", "2026-10", "closed", {
      closing_date: "2026-10-05",
      due_date: "2026-10-25",
    }),
    postings: [],
    ...over,
  } as unknown as Statement;

  return renderWithProviders(
    <StatementFigures statement={detail} scale={() => 2} />,
    { fetch: fakeApi({}) },
  );
}

function termOf(label: string): HTMLElement {
  const term = screen.getByText(label).closest("dl");

  if (term === null) throw new Error(`no term labelled ${label}`);

  return term;
}
