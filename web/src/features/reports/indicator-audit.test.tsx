import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { IndicatorMonth } from "@/features/overview";
import { IndicatorAudit } from "@/features/reports/indicator-audit";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { indicatorReport } from "@/testing/indicator-report";
import { renderWithProviders } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

describe("IndicatorAudit", () => {
  it("holds the month by month table closed until it is opened", async () => {
    renderAudit();

    expect(
      await screen.findByRole("button", {
        name: "Month by month and definitions",
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("writes one row per month with every figure of the payload", async () => {
    await openAudit();

    expect(screen.getAllByRole("row")).toHaveLength(13);

    const last = rowAt(12);

    for (const text of [
      "Oct 2026",
      "R$1,000.00",
      "R$800.00",
      "8.00%",
      "12.00%",
      "3.1 months",
      "17.44%",
      "0.00%",
      "R$5,000.00",
    ])
      expect(last.getAllByText(text).length).toBeGreaterThan(0);
  });

  it("writes a gap for a month before the first record", async () => {
    await openAudit();

    const first = rowAt(1);

    expect(first.getAllByText("—")).toHaveLength(9);
  });

  it("writes the reason of a ratio the month cannot give", async () => {
    await openAudit({ liquidity: { reason: "insufficient_history" } });

    const last = rowAt(12);

    expect(last.getByText("Short history")).toBeInTheDocument();
  });

  it("writes the definitions and the basis", async () => {
    await openAudit();

    expect(
      screen.getByText(catalogEn["report.indicators.committedNote"]),
    ).toBeInTheDocument();
    expect(screen.getByText("Cash basis.")).toBeInTheDocument();
  });
});

function renderAudit(last: Partial<IndicatorMonth> = {}) {
  return renderWithProviders(
    <IndicatorAudit report={indicatorReport({ last })} />,
    { fetch: fakeApi({ ...reportApiRoutes() }) },
  );
}

async function openAudit(last: Partial<IndicatorMonth> = {}) {
  renderAudit(last);

  await userEvent.click(
    await screen.findByRole("button", {
      name: "Month by month and definitions",
    }),
  );
}

function rowAt(index: number) {
  const row = screen.getAllByRole("row")[index];

  if (row === undefined) throw new Error(`no row at ${String(index)}`);

  return within(row);
}
