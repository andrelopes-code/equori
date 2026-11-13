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

const planList = () =>
  screen.findByRole("list", { name: catalogPtBR["contributionPlan.ideal"] });

const rowOf = (list: HTMLElement, name: string) =>
  within(list)
    .getAllByRole("listitem")
    .find((row) => text(row).startsWith(name)) ?? document.body;

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

  it("S400: writes what each group receives in words, never a dash", async () => {
    await open();
    const list = await planList();

    await waitFor(() => {
      expect(rowOf(list, "Ações Brasil")).toHaveTextContent(
        "recebe R$ 1.000,00",
      );
    });
    expect(rowOf(list, "Ações exterior")).toHaveTextContent(
      "recebe R$ 3.000,00",
    );
    expect(rowOf(list, "Renda fixa")).toHaveTextContent("não recebe neste mês");
    expect(rowOf(list, "FIIs")).toHaveTextContent("não recebe neste mês");
    expect(list).not.toHaveTextContent("—");
    expect(await screen.findByRole("textbox", { name: "Aporte" })).toHaveValue(
      "4.000,00",
    );
  });

  it("S400: says where the money goes, in list order, and which groups receive nothing", async () => {
    await open();

    await waitFor(() => {
      expect(
        screen.getByText(
          (_, node) =>
            node?.textContent.startsWith("Aplique") === true &&
            node.children.length === 0 &&
            text(node) ===
              "Aplique R$ 1.000,00 em Ações Brasil e R$ 3.000,00 em Ações exterior. Os demais grupos não recebem neste mês.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("names the three shares of a group on its bar", async () => {
    await open();

    expect(
      await screen.findByRole("img", {
        name: "Ações exterior: hoje 5,6%, depois do aporte 18%, ideal 20%",
      }),
    ).toBeInTheDocument();
  });

  it("explains the screen and keeps the three steps collapsed", async () => {
    await open();

    expect(
      await screen.findByText(catalogPtBR["contributionPlan.intro"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: catalogPtBR["contributionPlan.how"],
        expanded: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar grupos e ideais" }),
    ).toBeInTheDocument();
  });

  it("asks for the amount when the plan has none", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    const withoutAmount = structuredClone(saved) as Partial<typeof saved>;
    delete withoutAmount.amount;
    await renderApp("/portfolio/contribution-plan", {
      fetch: portfolioApi({
        "GET /api/v1/contribution-plan": () => json(200, withoutAmount),
      }),
    });

    expect(
      await screen.findByText(catalogPtBR["contributionPlan.verdictNoAmount"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: catalogPtBR["contributionPlan.shopping"],
      }),
    ).not.toBeInTheDocument();
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

  it("hides the purchase list while a group has no name", async () => {
    await open();
    await screen.findByRole("table", {
      name: catalogPtBR["contributionPlan.shopping"],
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: catalogPtBR["contributionPlan.edit"],
      }),
    );
    await userEvent.clear(await screen.findByDisplayValue("Ações exterior"));

    expect(
      await screen.findByText(
        catalogPtBR["contributionPlan.verdictNameMissing"],
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: catalogPtBR["contributionPlan.shopping"],
      }),
    ).not.toBeInTheDocument();
  });

  it("hides every amount and disables the copy in privacy mode", async () => {
    hideAmounts();
    await open();
    const table = await planList();

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

  it("draws the way back to the portfolio inside the page header", async () => {
    await open();
    await planList();

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
    const table = await planList();

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

    expect(await planList()).toBeInTheDocument();
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

  it("writes the placeholder in the class selector of a position outside the plan", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    const fetch = portfolioApi({
      "GET /api/v1/contribution-plan": () =>
        json(200, {
          ...saved,
          outside: [{ instrument: "PETR4", value: brl(100000) }],
        }),
      "POST /api/v1/contribution-plan/preview": () => json(200, preview),
    });
    await renderApp("/portfolio/contribution-plan", { fetch });

    await waitFor(() => {
      expect(
        screen.getByText(catalogPtBR["contributionPlan.chooseClass"]),
      ).toBeInTheDocument();
    });
  });

  it("C2: states the missing price of a position outside the plan in words", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    const fetch = portfolioApi({
      "GET /api/v1/contribution-plan": () =>
        json(200, { ...saved, outside: [{ instrument: "PETR4" }] }),
      "POST /api/v1/contribution-plan/preview": () =>
        json(200, { ...preview, outside: [{ instrument: "PETR4" }] }),
    });
    await renderApp("/portfolio/contribution-plan", { fetch });

    await waitFor(() => {
      expect(
        within(outsideSection()).getByText(
          catalogPtBR["contributionPlan.noPrice"],
        ),
      ).toBeInTheDocument();
    });
  });

  it("names an instrument outside the plan and shows its code at the end", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    const fetch = portfolioApi({
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [
            { code: "BTCBRL", type: "crypto", scale: 8, name: "Bitcoin" },
          ],
        }),
      "GET /api/v1/contribution-plan": () =>
        json(200, {
          ...saved,
          outside: [{ instrument: "BTCBRL", value: brl(100000) }],
        }),
      "POST /api/v1/contribution-plan/preview": () =>
        json(200, {
          ...preview,
          outside: [{ instrument: "BTCBRL", value: brl(100000) }],
        }),
    });
    await renderApp("/portfolio/contribution-plan", { fetch });

    await waitFor(() => {
      expect(within(outsideSection()).getByText("Bitcoin")).toBeInTheDocument();
      expect(within(outsideSection()).getByText("BTCBRL")).toBeInTheDocument();
    });
  });

  it("keys each position outside the plan by its reference, not by its name", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetch = portfolioApi({
      "GET /api/v1/contribution-plan": () =>
        json(200, {
          ...saved,
          outside: [
            { account_id: "unknown-a", value: brl(100000) },
            { account_id: "unknown-b", value: brl(200000) },
          ],
        }),
      "POST /api/v1/contribution-plan/preview": () => json(200, preview),
    });
    try {
      await renderApp("/portfolio/contribution-plan", { fetch });

      await waitFor(() => {
        expect(
          screen.getAllByText(catalogPtBR["contributionPlan.chooseClass"]),
        ).toHaveLength(2);
      });

      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});

function outsideSection() {
  return screen.getByRole("region", {
    name: catalogPtBR["contributionPlan.outside"],
  });
}
