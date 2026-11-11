import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { screen } from "@testing-library/react";
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

function method(): HTMLElement {
  return screen.getByRole("button", { name: catalogEn["holdings.method"] });
}

describe("ReturnView", () => {
  it("RC1: states the verdict of a market return, its comparisons and the money", () => {
    renderView(market, "portfolio");

    expect(
      screen.getByText(
        "In the period, the portfolio returned −10.00%: 10.33 pp below the CDI, with a real return of −0.89% over the IPCA.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Against the CDI")).toBeInTheDocument();
    expect(screen.getByText("Against inflation")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: sectionTitle, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: catalogEn["return.money.title"],
        level: 2,
      }),
    ).toBeInTheDocument();
  });

  it("RC1: states the verdict of a compared return and keeps the profile sentence", () => {
    renderView(compared, "portfolio");

    expect(
      screen.getByText(
        "In the period, the portfolio returned 0.33%, against 0.33% of the CDI.",
      ),
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

    expect(method()).toHaveAttribute("aria-expanded", "false");
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

  it("PC11: states the personal rate as one figure when nothing else draws", () => {
    renderView(plain, "portfolio");

    expect(screen.getByText("5.00%")).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["holdings.return.personal"]),
    ).toBeInTheDocument();
  });
});
