import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import {
  comparedReturn,
  marketReturn,
  plainReturn,
} from "@/testing/portfolio-api";
import { renderWithProviders } from "@/testing/render-app";

import { ReturnView } from "@/features/portfolio/return/return-view";
import type { ReturnSubject } from "@/features/portfolio/model/return-summary";

type ReturnReport = components["schemas"]["ReturnReport"];

const detail = {
  started_late: false,
  credits: 0,
  restarted: false,
  skipped: 0,
};
const market: ReturnReport = {
  ...plainReturn,
  profile: "market",
  period_bp: marketReturn.period_bp,
  benchmark: { ...marketReturn.benchmark, ...detail },
  inflation: marketReturn.inflation,
};
const compared: ReturnReport = {
  ...plainReturn,
  profile: "rate",
  period_bp: comparedReturn.period_bp,
  benchmark: { ...comparedReturn.benchmark, ...detail },
};
const plain: ReturnReport = { ...plainReturn, profile: "rate" };
const unrecorded: ReturnReport = {
  ...plain,
  unavailable_reason: "no_yield_recorded",
};

const sectionTitle = "Return";

function renderView(report: ReturnReport, subject: ReturnSubject) {
  return renderWithProviders(
    <Section size="lg" aria-label={sectionTitle}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{sectionTitle}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <ReturnView report={report} subject={subject} />
      </SectionBody>
    </Section>,
    { fetch: fakeApi({}) },
  );
}

// RE2: a report whose annual rate has no solution.
function withoutAnnual(report: ReturnReport): ReturnReport {
  const copy = { ...report };
  delete copy.annual_bp;

  return copy;
}

function method(): HTMLElement {
  return screen.getByRole("button", {
    name: catalogEn["holdings.method.open"],
  });
}

describe("ReturnView", () => {
  it("RC1: states the verdict of a market return, its comparisons and the money", () => {
    renderView(market, "portfolio");

    expect(
      screen.getByText("In the period, the portfolio returned −10.00%."),
    ).toBeInTheDocument();
    expect(screen.getByText("Against the CDI")).toBeInTheDocument();
    expect(screen.getByText("Against inflation")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: sectionTitle, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["return.origin.title"]),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  // Fixture: plainReturn opens at 100000, closes at 105000 and holds no flow, so the gain is
  // 105000 - 100000 = 5000; this harness serves no instrument, so the scale is 0 and the amount
  // reads R$5,000. annual_bp is 500.
  it("RK1, RK6: leads with the gain in money and writes the annual rate beside the button", async () => {
    renderView(market, "portfolio");

    const lead = (
      await screen.findByText(catalogEn["return.lead.gain"])
    ).closest("div");

    expect(lead?.textContent).toBe(`${catalogEn["return.lead.gain"]}R$5,000`);
    expect(screen.getByText("Annual rate 5.00%")).toBeInTheDocument();
    expect(screen.queryByText(/Closing R\$/)).not.toBeInTheDocument();
  });

  it("RC1: states the verdict of a compared return and keeps the profile sentence", () => {
    renderView(compared, "portfolio");

    expect(
      screen.getByText("In the period, the portfolio returned 0.33%."),
    ).toBeInTheDocument();
    expect(screen.getByText("Against the CDI")).toBeInTheDocument();
    expect(screen.queryByText("Against inflation")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        catalogEn["portfolio.yield.profile.rate"].replaceAll("{index}", "CDI"),
      ),
    ).toBeInTheDocument();
  });

  it("RC6: keeps the details closed and holds the groups in them", () => {
    renderView(market, "portfolio");

    expect(method()).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", {
        name: catalogEn["portfolio.yield.group.index"].replace(
          "{index}",
          "CDI",
        ),
      }),
    ).not.toBeInTheDocument();
  });

  it("RC7: states the note of a report with no yield recorded and no verdict", () => {
    renderView(unrecorded, "account");

    expect(
      screen.getByText(catalogEn["portfolio.yield.reason.no_yield_recorded"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(/In the period/)).not.toBeInTheDocument();
    expect(method()).toBeInTheDocument();
  });

  it("HR3: states the personal rate in a sentence when nothing else draws", () => {
    renderView(plain, "portfolio");

    expect(
      screen.getByText("In the period, your personal rate was 5.00% a year."),
    ).toBeInTheDocument();
  });

  it("RE4: states no personal rate without annual_bp", () => {
    renderView(withoutAnnual(plain), "portfolio");

    expect(screen.queryByText(/personal rate/)).not.toBeInTheDocument();
  });

  it("RE4: omits the annual line and the personal row without annual_bp", async () => {
    const user = userEvent.setup();
    renderView(withoutAnnual(market), "account");

    expect(screen.queryByText(/Annual rate/)).not.toBeInTheDocument();

    await user.click(method());

    expect(
      await screen.findByText(catalogEn["holdings.method.period"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(catalogEn["holdings.method.personal"]),
    ).not.toBeInTheDocument();
  });

  it("HR4: explains why each comparison has its own window", async () => {
    const user = userEvent.setup();
    renderView(market, "portfolio");

    expect(
      screen.getByText("Portfolio and CDI, 01/02/2026 to 01/09/2026 · 6 days"),
    ).toBeInTheDocument();

    await user.hover(
      screen.getByRole("button", { name: "About “Against the CDI”" }),
    );

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Both bars measure the portfolio and the CDI on those days",
    );
  });
});
