import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import {
  contributionReturn,
  plainReturn,
  portfolioApi,
} from "@/testing/portfolio-api";
import { renderWithProviders } from "@/testing/render-app";

import { ReturnMoneyPanel } from "@/features/portfolio/return-money/return-money-panel";
import type { ReturnSubject } from "@/features/portfolio/model/return-summary";

type ReturnReport = components["schemas"]["ReturnReport"];

const opening = catalogEn["return.money.opening"];
const deposits = catalogEn["return.money.deposits"];
const gain = catalogEn["return.money.gain"];
const closing = catalogEn["return.money.closing"];
const growth = catalogEn["return.growth.title"];

const plain: ReturnReport = { ...plainReturn, profile: "rate" };
const contribution: ReturnReport = { ...contributionReturn, profile: "rate" };

describe("ReturnMoneyPanel", () => {
  it.each([
    {
      name: "a plain return on an account",
      report: plain,
      surface: "account",
      rows: [
        [opening, "R$1,000.00"],
        [gain, "R$50.00"],
        [closing, "R$1,050.00"],
      ],
      absent: [deposits, growth],
    },
    {
      name: "a contribution on the portfolio",
      report: contribution,
      surface: "portfolio",
      rows: [
        [opening, "R$1,000.00"],
        [deposits, "R$1,000.00"],
        [gain, "R$50.00"],
        [closing, "R$2,050.00"],
      ],
      absent: [],
      present: [growth],
    },
    {
      name: "a contribution on an account",
      report: contribution,
      surface: "account",
      rows: [
        [opening, "R$1,000.00"],
        [deposits, "R$1,000.00"],
        [gain, "R$50.00"],
        [closing, "R$2,050.00"],
      ],
      absent: [growth],
    },
  ] satisfies {
    name: string;
    report: ReturnReport;
    surface: ReturnSubject;
    rows: [string, string][];
    absent: string[];
    present?: string[];
  }[])("draws $name", async ({ report, surface, rows, absent, present }) => {
    renderPanel(report, surface);

    await screen.findByText(catalogEn["return.money.title"]);

    for (const [term, value] of rows) {
      await waitFor(() => {
        expect(row(term).textContent).toBe(`${term}${value}`);
      });
    }

    for (const term of absent) {
      expect(screen.queryByText(term)).toBeNull();
    }

    for (const term of present ?? []) {
      expect(screen.getByText(term)).toBeTruthy();
    }
  });

  it("draws a negative gain in the danger tone and no growth bar", async () => {
    renderPanel(
      { ...plain, closing: { amount: 90000, currency: "BRL" } },
      "portfolio",
    );

    await screen.findByText(catalogEn["return.money.title"]);

    await waitFor(() => {
      expect(row(gain).textContent).toBe(`${gain}−R$100.00`);
    });
    expect(screen.getByText("−R$100.00").getAttribute("data-tone")).toBe(
      "danger",
    );
    expect(screen.queryByText(growth)).toBeNull();
  });

  it("draws nothing when an amount is in another currency", () => {
    const report = {
      ...plain,
      closing: { amount: 105000, currency: "USD" },
    };

    const { container } = renderPanel(report, "portfolio");

    expect(container.textContent).toBe("");
  });

  it("masks every amount in privacy mode", async () => {
    localStorage.setItem("equori.privacy", "hidden");

    try {
      const { container } = renderPanel(contribution, "portfolio");

      await screen.findByText(catalogEn["return.money.title"]);

      expect(screen.getByText(growth)).toBeTruthy();
      expect(container.textContent).not.toMatch(/\d/u);
    } finally {
      localStorage.removeItem("equori.privacy");
    }
  });
});

function renderPanel(report: ReturnReport, surface: ReturnSubject) {
  return renderWithProviders(
    <ReturnMoneyPanel report={report} surface={surface} />,
    { fetch: portfolioApi() },
  );
}

function row(term: string): HTMLElement {
  const item = screen.getByText(term, { selector: "dt" }).closest("div");
  if (item === null) throw new Error(`no row for ${term}`);

  return item;
}
