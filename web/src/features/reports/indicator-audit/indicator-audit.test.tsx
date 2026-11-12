import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { IndicatorMonth } from "@/features/overview";
import { IndicatorAudit } from "@/features/reports/indicator-audit/indicator-audit";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { indicatorReport } from "@/testing/indicator-report";
import { renderWithProviders } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

const openLabel = catalogEn["report.indicators.audit.open"];

describe("IndicatorAudit", () => {
  it("L5: holds the table absent until the layer is opened", async () => {
    renderAudit();

    expect(
      await screen.findByRole("button", { name: openLabel }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.getByText("12 months, from Nov 2025 to Oct 2026."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: openLabel }));

    expect(rowAt(1).getAllByText("Nov 2025").length).toBeGreaterThan(0);
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

  it("L5: the position rows come first in the layer", async () => {
    await openAudit();

    const layer = within(screen.getByRole("dialog"));
    const title = layer.getByText(catalogEn["report.indicators.board.title"]);
    const table = layer.getByRole("table");

    expect(
      layer.getAllByText(catalogEn["report.indicators.board.title"]),
    ).toHaveLength(1);
    expect(
      title.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    <IndicatorAudit report={indicatorReport({ last })} incomplete={false} />,
    { fetch: fakeApi({ ...reportApiRoutes() }) },
  );
}

async function openAudit(last: Partial<IndicatorMonth> = {}) {
  renderAudit(last);

  await userEvent.click(await screen.findByRole("button", { name: openLabel }));
}

function rowAt(index: number) {
  const row = screen.getAllByRole("row")[index];

  if (row === undefined) throw new Error(`no row at ${String(index)}`);

  return within(row);
}
