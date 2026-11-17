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

type ReturnReport = components["schemas"]["ReturnReport"];

const opening = catalogEn["return.money.opening"];
const deposits = catalogEn["return.money.deposits"];
const gain = catalogEn["return.money.gain"];
const closing = catalogEn["return.money.closing"];
const title = catalogEn["return.origin.title"];

const plain: ReturnReport = { ...plainReturn, profile: "rate" };
const contribution: ReturnReport = { ...contributionReturn, profile: "rate" };

describe("ReturnMoneyPanel", () => {
  it.each([
    {
      name: "a plain return",
      report: plain,
      rows: [
        [opening, "R$1,000.00"],
        [gain, "R$50.00"],
        [closing, "R$1,050.00"],
      ],
      absent: [deposits],
      segments: [
        ["opening", "100000"],
        ["gain", "5000"],
      ],
    },
    {
      name: "a contribution",
      report: contribution,
      rows: [
        [opening, "R$1,000.00"],
        [deposits, "R$1,000.00"],
        [gain, "R$50.00"],
        [closing, "R$2,050.00"],
      ],
      absent: [],
      segments: [
        ["opening", "100000"],
        ["deposits", "100000"],
        ["gain", "5000"],
      ],
    },
  ] satisfies {
    name: string;
    report: ReturnReport;
    rows: [string, string][];
    absent: string[];
    segments: [string, string][];
  }[])("RK3, RK4: draws $name", async ({ report, rows, absent, segments }) => {
    const { container } = renderPanel(report);

    await screen.findByText(title);

    for (const [term, value] of rows) {
      await waitFor(() => {
        expect(row(term).textContent).toBe(`${term}${value}`);
      });
    }

    for (const term of absent) {
      expect(screen.queryByText(term)).toBeNull();
    }

    expect(drawnSegments(container)).toEqual(segments);
  });

  it("gives every term a help button (return honesty HR6)", async () => {
    renderPanel(plain);

    await screen.findByText(title);

    for (const key of ["opening", "gain", "closing"] as const) {
      const term = catalogEn[`return.money.${key}`];

      expect(
        screen.getByRole("button", { name: `About “${term}”` }),
      ).toBeTruthy();
    }
  });

  it("RK4: draws a negative gain in the danger tone and no bar", async () => {
    const { container } = renderPanel({
      ...plain,
      closing: { amount: 90000, currency: "BRL" },
    });

    await screen.findByText(title);

    await waitFor(() => {
      expect(row(gain).textContent).toBe(`${gain}−R$100.00`);
    });
    expect(screen.getByText("−R$100.00").getAttribute("data-tone")).toBe(
      "danger",
    );
    expect(drawnSegments(container)).toEqual([]);
  });

  it("hides the bar from assistive technology", async () => {
    const { container } = renderPanel(contribution);

    await screen.findByText(title);

    const bar = container.querySelector("[data-segment]")?.parentElement;

    expect(bar?.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws nothing when an amount is in another currency", () => {
    const report = {
      ...plain,
      closing: { amount: 105000, currency: "USD" },
    };

    const { container } = renderPanel(report);

    expect(container.textContent).toBe("");
  });

  it("masks every amount in privacy mode", async () => {
    localStorage.setItem("equori.privacy", "hidden");

    try {
      const { container } = renderPanel(contribution);

      await screen.findByText(title);

      expect(container.textContent).not.toMatch(/\d/u);
    } finally {
      localStorage.removeItem("equori.privacy");
    }
  });
});

function renderPanel(report: ReturnReport) {
  return renderWithProviders(<ReturnMoneyPanel report={report} />, {
    fetch: portfolioApi(),
  });
}

function row(term: string): HTMLElement {
  const item = screen.getByText(term, { selector: "dt" }).closest("div");
  if (item === null) throw new Error(`no row for ${term}`);

  return item;
}

function drawnSegments(container: HTMLElement): [string, string][] {
  return [...container.querySelectorAll<HTMLElement>("[data-segment]")].map(
    (segment) => [segment.dataset.segment ?? "", segment.style.flexGrow],
  );
}
