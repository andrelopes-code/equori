import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { indicatorsFixture, reportApiRoutes } from "@/testing/report-api";

describe("Reports indicators", () => {
  it("answers in order for the last complete month", async () => {
    const months: (string | null)[] = [];
    await renderApp("/reports?tab=indicators", {
      fetch: indicatorsApi(indicatorsFixture(), months),
    });

    expect(
      await screen.findByText("Savings rate in October"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3.50 pp below the 12-month mean (46.50%)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Where the month stands in the last 12 months"),
    ).toBeInTheDocument();
    expect(screen.getByText("Reserve and debts")).toBeInTheDocument();
    expect(screen.getByText("Income and expense by month")).toBeInTheDocument();
    expect(screen.getByText("Savings rate by month")).toBeInTheDocument();
    await waitFor(() => {
      expect(months).toContain("2026-09");
    });
  });

  it("tags the current month as in progress and leaves its rate out of the comparison", async () => {
    await renderApp("/reports?tab=indicators&month=2026-10", {
      fetch: indicatorsApi(indicatorsFixture()),
    });

    expect(
      await screen.findByText(
        "In progress: it only compares with a closed month.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("In progress until October 17"),
    ).toBeInTheDocument();
  });

  it("writes the report currency, never a literal one", async () => {
    await renderApp("/reports?tab=indicators&month=2026-10", {
      fetch: indicatorsApi({ ...indicatorsFixture(), currency: "USD" }),
    });

    expect(await screen.findAllByText("$5,000.00")).not.toHaveLength(0);
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("masks amounts and keeps ratios in privacy mode", async () => {
    hideAmounts();
    const { container } = await renderApp(
      "/reports?tab=indicators&month=2026-10",
      { fetch: indicatorsApi(indicatorsFixture()) },
    );

    await screen.findByText("Reserve and debts");

    const ratios = document.createElement("div");
    ratios.innerHTML = container.innerHTML.replace(/[\d.,]+\s?%/g, "");

    expectNoAmounts(ratios, ["5,000.00", "2,850.00"]);
  });
});

function indicatorsApi(
  report: ReturnType<typeof indicatorsFixture>,
  months: (string | null)[] = [],
) {
  return fakeApi({
    ...reportApiRoutes(),
    "GET /api/v1/reports/indicators": (req: Request) => {
      months.push(new URL(req.url).searchParams.get("month"));

      return json(200, report);
    },
  });
}
