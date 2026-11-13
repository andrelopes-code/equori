import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { json } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const noPlan = {
  status: "complete",
  total: brl(0),
  classes: [],
  outside: [],
  missing: [],
};

// CN12: two positions of two types, 5 000 and 3 000 minor units.
const withPositions = {
  ...noPlan,
  total: brl(8000),
  outside: [
    { instrument: "PETR4", value: brl(5000) },
    { instrument: "MXRF11", value: brl(3000) },
  ],
};

// S402: a member without a price; the target shares stay, the figures go.
const incomplete = {
  status: "incomplete",
  amount: brl(400000),
  total: brl(1000000),
  classes: [
    {
      name: "FIIs",
      target_bp: 6000,
      value: brl(0),
      members: [],
    },
    {
      name: "Renda fixa",
      target_bp: 4000,
      value: brl(0),
      members: [],
    },
  ],
  outside: [],
  missing: [
    { instrument: "KNRI11", kind: "price" },
    { instrument: "USD", kind: "rate" },
  ],
};

async function open(plan: unknown) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      "GET /api/v1/contribution-plan": () => json(200, plan),
    }),
  });
}

describe("Contribution plan without a plan", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("offers to start from the portfolio or from scratch", async () => {
    await open(withPositions);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: catalogPtBR["contributionPlan.startPortfolio"],
        }),
      ).toBeEnabled();
    });
    expect(
      screen.getByRole("button", {
        name: catalogPtBR["contributionPlan.startScratch"],
      }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("link", {
        name: catalogPtBR["contributionPlan.firstPurchase"],
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: catalogPtBR["contributionPlan.edit"],
      }),
    ).not.toBeInTheDocument();
  });

  it("CN12: starting from the portfolio opens edit mode with one class per type at its share", async () => {
    await open(withPositions);

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogPtBR["contributionPlan.startPortfolio"],
      }),
    );

    const names = await screen.findAllByRole("textbox", {
      name: catalogPtBR["contributionPlan.className"],
    });
    expect(names.map((n) => (n as HTMLInputElement).value)).toEqual([
      "Ações",
      "Fundos imobiliários",
    ]);
    expect(
      await screen.findByRole("textbox", { name: "Ideal: Ações" }),
    ).toHaveValue("62,5");
    expect(
      screen.getByRole("textbox", { name: "Ideal: Fundos imobiliários" }),
    ).toHaveValue("37,5");
  });

  it("starting from scratch opens one blank class at 100% with its name focused", async () => {
    await open(withPositions);

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogPtBR["contributionPlan.startScratch"],
      }),
    );

    const name = await screen.findByRole("textbox", {
      name: catalogPtBR["contributionPlan.className"],
    });
    expect(name).toHaveValue("");
    expect(name).toHaveFocus();
    expect(
      screen.getByText(catalogPtBR["contributionPlan.nameRequired"]),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Ideal/ })).toHaveValue(
      "100,0",
    );
  });

  it("states a blank group name once above the rows, never inside a row", async () => {
    await open(withPositions);

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogPtBR["contributionPlan.startScratch"],
      }),
    );

    const name = await screen.findByRole("textbox", {
      name: catalogPtBR["contributionPlan.className"],
    });
    const message = screen.getByText(
      catalogPtBR["contributionPlan.nameRequired"],
    );
    expect(name).toBeInvalid();
    expect(name.getAttribute("aria-describedby")).toContain(message.id);
    expect(message.closest("[role='table'], table")).toBeNull();
    expect(
      screen.getAllByText(catalogPtBR["contributionPlan.nameRequired"]),
    ).toHaveLength(1);
  });

  it("links to the first purchase when the book holds no position", async () => {
    await open(noPlan);

    const link = await screen.findByRole("link", {
      name: catalogPtBR["contributionPlan.firstPurchase"],
    });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/transactions/new"),
    );
    expect(
      screen.getByRole("button", {
        name: catalogPtBR["contributionPlan.startPortfolio"],
      }),
    ).toBeDisabled();
  });
});

describe("Contribution plan with a missing valuation", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("S402 CN10: lists each missing entry as a link to its instrument and waits for the price in words, never a dash", async () => {
    await open(incomplete);

    const price = await screen.findByRole("link", {
      name: "KNRI11: sem cotação",
    });
    expect(price).toHaveAttribute("href", "/instruments/KNRI11");
    expect(
      screen.getByRole("link", { name: "USD: sem câmbio" }),
    ).toHaveAttribute("href", "/instruments/USD");
    expect(
      screen.getByText(catalogPtBR["contributionPlan.incomplete"]),
    ).toBeInTheDocument();

    const list = await screen.findByRole("list", {
      name: catalogPtBR["contributionPlan.ideal"],
    });
    const row = within(list)
      .getAllByRole("listitem")
      .find((r) => r.textContent.startsWith("FIIs"));
    expect(row).toHaveTextContent("aguarda a cotação");
    expect(row).toHaveTextContent("ideal 60%");
    expect(list).not.toHaveTextContent("—");
  });
});
