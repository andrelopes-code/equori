import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { json } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

// S409: PETR4 at R$ 30,01 a unit receives 33 units for R$ 990,33 out of R$ 1.000,00 and R$ 9,67
// stay as the leftover; Tesouro is a class without member targets that holds an instrument.
const plan = {
  status: "complete",
  amount: brl(200000),
  total: brl(1800000),
  total_after: brl(2000000),
  drift_bp: 0,
  leftover: brl(967),
  classes: [
    {
      name: "Ações Brasil",
      target_bp: 5000,
      value: brl(300000),
      share_bp: 5000,
      amount: brl(100000),
      members: [
        {
          instrument: "PETR4",
          target_bp: 10000,
          value: brl(300000),
          share_bp: 10000,
          unit_value: brl(3001),
          amount: brl(100000),
          quantity: { amount: 33, currency: "PETR4" },
          cost: brl(99033),
        },
      ],
    },
    {
      name: "FIIs",
      target_bp: 5000,
      value: brl(300000),
      share_bp: 5000,
      amount: brl(100000),
      cost: brl(100000),
      members: [{ instrument: "MXRF11", value: brl(300000) }],
    },
  ],
  outside: [],
  missing: [],
};

const text = (node: Element) =>
  node.textContent.replaceAll(String.fromCharCode(160), " ");

async function open() {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      "GET /api/v1/contribution-plan": () => json(200, plan),
      "POST /api/v1/contribution-plan/preview": () => json(200, plan),
    }),
  });

  return screen.findByRole("table", { name: "Lista de compras" });
}

describe("Contribution plan, executable orders (CN17, CN18)", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("S409: writes the units and the cost of each row, and the leftover under the list", async () => {
    const list = await open();

    await waitFor(() => {
      expect(within(list).getAllByRole("row")).toHaveLength(2);
    });
    const [fiis, petr4] = within(list).getAllByRole("row");

    expect(text(fiis ?? list)).toContain("FIIs");
    expect(within(fiis ?? list).getByRole("button")).toHaveTextContent(
      "divida entre ativos para ver as cotas",
    );
    expect(within(fiis ?? list).getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(text(petr4 ?? list)).toContain("PETR4");
    expect(within(petr4 ?? list).getByText("≈ 33 cotas")).toBeInTheDocument();
    expect(within(petr4 ?? list).getByText("R$ 990,33")).toBeInTheDocument();
    expect(screen.getByText("Sobra R$ 9,67")).toBeInTheDocument();
  });

  it("writes the cost of each row of the portfolio against the ideal", async () => {
    await open();

    const ideal = await screen.findByRole("list", {
      name: "Carteira frente ao ideal",
    });
    const row = (name: string) =>
      within(ideal)
        .getAllByRole("listitem")
        .find((r) => text(r).startsWith(name)) ?? document.body;

    expect(text(row("Ações Brasil"))).toContain("recebe R$ 990,33");
    expect(text(row("FIIs"))).toContain("recebe R$ 1.000,00");
  });

  it.each([
    { from: 0, where: "the purchase list" },
    { from: 1, where: "the portfolio against the ideal" },
  ])(
    "opens the assets of the group from the action in $where",
    async ({ from }) => {
      await open();
      const user = userEvent.setup();
      const actions = await screen.findAllByRole("button", {
        name: "divida entre ativos para ver as cotas",
      });

      await user.click(actions[from] ?? document.body);

      expect(
        await screen.findByRole("button", { name: "Salvar" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Ativos (1)", expanded: true }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Adicionar ativo" }),
      ).toBeVisible();
    },
  );
});
