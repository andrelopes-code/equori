import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { json } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const cls = (
  name: string,
  target: number,
  value: number,
  share: number,
  after?: number,
  amount?: number,
) => ({
  name,
  target_bp: target,
  value: brl(value),
  share_bp: share,
  ...(after === undefined ? {} : { after_share_bp: after }),
  ...(amount === undefined ? {} : { amount: brl(amount) }),
  members: [],
});

// S400: a contribution of 4,000.00 raises the domestic and foreign stocks (CN14, CN15).
const saved = {
  status: "complete",
  amount: brl(400000),
  total: brl(1800000),
  drift_bp: 1777,
  classes: [
    cls("Renda fixa", 4000, 1000000, 5555),
    cls("Ações Brasil", 2000, 300000, 1666),
    cls("Ações exterior", 2000, 100000, 557),
    cls("FIIs", 2000, 400000, 2222),
  ],
  outside: [],
  missing: [],
};

const preview = {
  ...saved,
  total_after: brl(2200000),
  drift_after_bp: 545,
  classes: [
    cls("Renda fixa", 4000, 1000000, 5555, 4545, 0),
    cls("Ações Brasil", 2000, 300000, 1666, 1818, 100000),
    cls("Ações exterior", 2000, 100000, 557, 1818, 300000),
    cls("FIIs", 2000, 400000, 2222, 1819, 0),
  ],
};

const api = () =>
  portfolioApi({
    "GET /api/v1/contribution-plan": () => json(200, saved),
    "POST /api/v1/contribution-plan/preview": () => json(200, preview),
  });

const text = (node: Element) =>
  node.textContent.replaceAll(String.fromCharCode(160), " ");

const cells = (row: HTMLElement) =>
  [...row.querySelectorAll("th, td")].map(text);

const planTable = () =>
  screen.findByRole("table", { name: catalogPtBR["contributionPlan.title"] });

const rowOf = (table: HTMLElement, name: string) =>
  within(table)
    .getAllByRole("row")
    .find((row) => cells(row).includes(name)) ?? document.body;

describe("Contribution plan page", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
  });

  async function open() {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp("/portfolio/contribution-plan", { fetch: api() });
  }

  it("S400: writes the amount of each class and a dash for zero", async () => {
    await open();
    const table = await planTable();

    await waitFor(() => {
      expect(cells(rowOf(table, "Ações Brasil")).at(-1)).toBe("R$ 1.000,00");
    });
    expect(cells(rowOf(table, "Ações exterior")).at(-1)).toBe("R$ 3.000,00");
    expect(cells(rowOf(table, "Renda fixa")).at(-1)).toBe("—");
    expect(cells(rowOf(table, "FIIs")).at(-1)).toBe("—");
    expect(await screen.findByRole("textbox", { name: "Aporte" })).toHaveValue(
      "4.000,00",
    );
  });

  it("CN15: states the drift before and after the contribution", async () => {
    await open();

    expect(
      await screen.findByText(
        "Este aporte leva a carteira de 17,8 p.p. para 5,5 p.p. de distância do alvo.",
      ),
    ).toBeInTheDocument();
  });

  it("names the three shares of a class on its drift track", async () => {
    await open();

    expect(
      await screen.findByRole("img", {
        name: "Ações exterior: atual 5,6%, após 18,2%, alvo 20%",
      }),
    ).toBeInTheDocument();
  });

  it("lists the purchases by amount and masks them in privacy mode", async () => {
    await open();
    const list = await screen.findByRole("table", {
      name: catalogPtBR["contributionPlan.shopping"],
    });

    await waitFor(() => {
      expect(
        within(list)
          .getAllByRole("row")
          .map((row) =>
            cells(row)
              .filter((c) => c !== "")
              .join("|"),
          ),
      ).toEqual(["Ações exterior|R$ 3.000,00", "Ações Brasil|R$ 1.000,00"]);
    });
    expect(screen.getByRole("button", { name: "Copiar lista" })).toBeEnabled();
  });

  it("hides every amount and disables the copy in privacy mode", async () => {
    hideAmounts();
    await open();
    const table = await planTable();

    await within(table).findByText("Ações Brasil");
    expect(screen.getByRole("button", { name: "Copiar lista" })).toBeDisabled();
    expectNoAmounts(table, ["1.000,00", "3.000,00"]);
    expectNoAmounts(
      await screen.findByRole("table", {
        name: catalogPtBR["contributionPlan.shopping"],
      }),
      ["1.000,00", "3.000,00"],
    );
  });

  it("names the track and expander columns for assistive technology", async () => {
    await open();
    await planTable();

    expect(
      screen.getByRole("columnheader", { name: "Posição frente ao alvo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Ativos" }),
    ).toBeInTheDocument();
  });

  it("draws the way back to the portfolio inside the page header", async () => {
    await open();
    await planTable();

    const header = document.querySelector<HTMLElement>(
      "[data-ui='page-header']",
    );
    expect(
      within(header ?? document.body).getByRole("link", {
        name: catalogPtBR["nav.portfolio"],
      }),
    ).toHaveAttribute("href", "/portfolio");
  });

  it("points the expander at a row of the class's members", async () => {
    const user = userEvent.setup();
    const withMembers = {
      ...saved,
      amount: undefined,
      classes: [
        {
          ...cls("Ações Brasil", 10000, 300000, 10000),
          members: [
            {
              instrument: "PETR4",
              value: brl(300000),
              share_bp: 10000,
              target_bp: 10000,
            },
          ],
        },
      ],
    };
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp("/portfolio/contribution-plan", {
      fetch: portfolioApi({
        "GET /api/v1/contribution-plan": () => json(200, withMembers),
      }),
    });
    const table = await planTable();

    await user.click(
      await within(table).findByRole("button", { expanded: false }),
    );

    const button = await within(table).findByRole("button", { expanded: true });
    const id = button.getAttribute("aria-controls") ?? "";
    expect(document.getElementById(id)).toHaveTextContent("PETR4");
  });

  it("offers a retry when the plan fails to load", async () => {
    let failing = true;
    const fetch = portfolioApi({
      "GET /api/v1/contribution-plan": () =>
        failing
          ? json(500, { type: "about:blank", title: "boom", status: 500 })
          : json(200, saved),
    });
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp("/portfolio/contribution-plan", { fetch });

    expect(
      await screen.findByText(catalogPtBR["contributionPlan.loadFailed"]),
    ).toBeInTheDocument();
    failing = false;
    fireEvent.click(
      screen.getByRole("button", {
        name: catalogPtBR["contributionPlan.retry"],
      }),
    );

    expect(await planTable()).toBeInTheDocument();
  });

  it("says so when the list cannot be copied", async () => {
    vi.stubGlobal("isSecureContext", true);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    try {
      await open();
      fireEvent.click(
        await screen.findByRole("button", { name: "Copiar lista" }),
      );

      expect(
        await screen.findByText(catalogPtBR["contributionPlan.copyFailed"]),
      ).toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
      vi.unstubAllGlobals();
    }
  });

  it("draws only the header and the strip for a book without a plan", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    const fetch = portfolioApi({
      "GET /api/v1/contribution-plan": () =>
        json(200, {
          status: "complete",
          total: brl(0),
          classes: [],
          outside: [],
          missing: [],
        }),
    });
    await renderApp("/portfolio/contribution-plan", { fetch });

    expect(
      await screen.findByRole("heading", {
        name: catalogPtBR["contributionPlan.title"],
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("textbox", { name: "Aporte" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
