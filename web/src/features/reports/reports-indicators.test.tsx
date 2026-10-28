import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { indicatorsFixture, reportApiRoutes } from "@/testing/report-api";

describe("Reports indicators", () => {
  it("draws one chart per indicator for the current month", async () => {
    const months: (string | null)[] = [];
    await renderApp("/reports?tab=indicators", {
      fetch: fakeApi({
        ...reportApiRoutes(),
        "GET /api/v1/reports/indicators": (req: Request) => {
          months.push(new URL(req.url).searchParams.get("month"));
          return json(200, indicatorsFixture());
        },
      }),
    });
    for (const key of [
      "report.indicators.savings",
      "report.indicators.reserve",
      "report.indicators.committed",
      "report.indicators.debt",
      "report.indicators.liabilities",
      "report.indicators.savingsNote",
      "report.indicators.reserveNote",
      "report.indicators.committedNote",
      "report.indicators.debtNote",
      "report.indicators.liabilitiesNote",
    ] as const) {
      expect(
        (await screen.findAllByText(catalogEn[key])).length,
      ).toBeGreaterThan(0);
    }
    await waitFor(() => {
      expect(months).toContain("2026-10");
    });
  });
});
