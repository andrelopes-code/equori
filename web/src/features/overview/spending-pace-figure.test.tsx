import { DashboardGrid } from "@slotted/react/dashboard-grid";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { placement } from "@/features/overview/overview-block";
import { SpendingPaceFigure } from "@/features/overview/spending-pace-figure";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

describe("spending pace figure", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("S273: compares the month to today with the same days of the month before", async () => {
    renderPace("2026-10-17", {
      "2026-10-01/2026-10-17": [
        total(50000),
        total(100000),
        total(5000, "USD"),
      ],
      "2026-09-01/2026-09-17": [total(40000), total(100000)],
    });

    const widget = await screen.findByRole("article", {
      name: "Spending pace",
    });

    await waitFor(() => {
      expect(widget).toHaveTextContent("R$1,500.00");
    });
    expect(widget).toHaveTextContent("+7.1%");
    expect(widget).toHaveTextContent("Same days of september: R$1,400.00");
  });

  it("S274: ends the range before on the last day of a shorter month", async () => {
    renderPace("2026-03-31", {
      "2026-03-01/2026-03-31": [total(100000)],
      "2026-02-01/2026-02-28": [total(80000)],
    });

    const widget = await screen.findByRole("article", {
      name: "Spending pace",
    });

    await waitFor(() => {
      expect(widget).toHaveTextContent("R$1,000.00");
    });
    expect(widget).toHaveTextContent("+25%");
    expect(widget).toHaveTextContent("Same days of february: R$800.00");
  });

  it("S275: draws no change when the days before hold no spending", async () => {
    renderPace("2026-10-17", {
      "2026-10-01/2026-10-17": [total(50000)],
      "2026-09-01/2026-09-17": [],
    });

    const widget = await screen.findByRole("article", {
      name: "Spending pace",
    });

    await waitFor(() => {
      expect(widget).toHaveTextContent("R$500.00");
    });
    expect(widget).toHaveTextContent(
      "No spending in the same days of september",
    );
    expect(widget).not.toHaveTextContent("%");
  });
});

function renderPace(
  today: string,
  totals: Record<string, ReturnType<typeof total>[]>,
) {
  return renderWithRouter(
    <DashboardGrid aria-label="Overview blocks">
      <SpendingPaceFigure {...placement("pace", "Spending pace", 4, 2)} />
    </DashboardGrid>,
    {
      path: "/",
      today,
      fetch: fakeApi({
        ...reportApiRoutes(),
        "GET /api/v1/reports/categories": (req: Request) => {
          const q = new URL(req.url).searchParams;
          const items = totals[`${q.get("from") ?? ""}/${q.get("to") ?? ""}`];

          return items === undefined
            ? problem(400, "validation_failed")
            : json(200, { items });
        },
      }),
    },
  );
}

function total(amount: number, currency = "BRL") {
  return {
    account_id: "ca000000-0000-4000-8000-000000000001",
    total: { amount, currency },
    subtree_total: { amount, currency },
  };
}
