import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
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

  // Spec, Purchase list as one bar: the order is units times the unit price, each row writes its
  // share of the R$ 2.000,00 (990,33 + 1.000,00 + 9,67), and the leftover is the last row.
  it("S409: writes the order, the cost and the share of each row, and the leftover as the last row", async () => {
    const list = await open();

    await waitFor(() => {
      expect(within(list).getAllByRole("row")).toHaveLength(4);
    });
    const [, fiis, petr4, leftover] = within(list).getAllByRole("row");

    expect(text(fiis ?? list)).toContain("FIIs");
    expect(within(fiis ?? list).getByRole("button")).toHaveTextContent(
      "divida entre ativos para ver as cotas",
    );
    expect(within(fiis ?? list).getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(within(fiis ?? list).getByText("50%")).toBeInTheDocument();
    expect(text(petr4 ?? list)).toContain("PETR4");
    expect(within(petr4 ?? list).getByText("Ações Brasil")).toBeInTheDocument();
    expect(text(petr4 ?? list)).toContain("≈ 33 cotas × R$ 30,01");
    expect(within(petr4 ?? list).getByText("R$ 990,33")).toBeInTheDocument();
    expect(within(petr4 ?? list).getByText("50%")).toBeInTheDocument();
    expect(text(leftover ?? list)).toContain("Sobrafica na conta");
    expect(within(leftover ?? list).getByText("R$ 9,67")).toBeInTheDocument();
    expect(within(leftover ?? list).getByText("0,5%")).toBeInTheDocument();
  });

  it("draws the contribution as one bar named by its shares", async () => {
    await open();

    expect(
      await screen.findByRole("img", {
        name: "Divisão do aporte: FIIs 50%, PETR4 50% e Sobra 0,5%",
      }),
    ).toBeInTheDocument();
    expect(text(document.body)).toContain("aporte R$ 2.000,00");
  });

  it("marks the segment of the row under the pointer", async () => {
    const list = await open();
    const user = userEvent.setup();
    const bar = await screen.findByRole("img", { name: /Divisão do aporte/ });
    const petr4 = within(list).getAllByRole("row")[2] ?? list;

    await user.hover(petr4);

    expect(bar).toHaveAttribute("data-active", "true");
    const marked = Array.from(bar.children).map((s) =>
      s.getAttribute("data-current"),
    );
    expect(marked).toEqual(["false", "true", "false"]);

    await user.unhover(petr4);

    expect(bar).toHaveAttribute("data-active", "false");
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

  it("S409: the portfolio against the ideal shows no split action", async () => {
    await open();

    const ideal = await screen.findByRole("list", {
      name: "Carteira frente ao ideal",
    });

    expect(
      within(ideal).queryByRole("button", {
        name: "divida entre ativos para ver as cotas",
      }),
    ).not.toBeInTheDocument();
    expect(text(ideal)).not.toContain("divida entre ativos");
  });

  it.each([
    { how: "a click", act: "{MouseLeft}" },
    { how: "Enter", act: "{Enter}" },
    { how: "Space", act: " " },
  ])(
    "opens the assets of the group from the purchase list action by $how",
    async ({ act }) => {
      await open();
      const user = userEvent.setup();
      const action = await screen.findByRole("button", {
        name: "divida entre ativos para ver as cotas",
      });

      if (act === "{MouseLeft}") {
        await user.click(action);
      } else {
        action.focus();
        await user.keyboard(act);
      }

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

// A group without members is bought by value; PETR4 has a quantity.
const comparablePlan = {
  ...plan,
  classes: [
    {
      name: "Reserva",
      target_bp: 5000,
      value: brl(300000),
      share_bp: 5000,
      amount: brl(100000),
      cost: brl(100000),
      members: [],
    },
    plan.classes[0],
  ],
};

const expectedCdi = {
  ...cdiFixture(),
  expectations: {
    survey_date: "2026-10-16",
    items: [{ date: "2026-11-18", rate: "0.1" }],
  },
};

// The index and curve routes of the calculators, to offer the comparison.
function indexRoutes(withExpected: boolean) {
  const routes = calculatorApiRoutes(
    withExpected ? [expectedCdi] : [cdiFixture()],
  );

  return Object.fromEntries(
    Object.entries(routes).filter(
      ([key]) => key.includes("/indexes") || key.includes("/curves"),
    ),
  );
}

async function openComparable(withExpected = true) {
  const previews = { count: 0 };
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      ...indexRoutes(withExpected),
      "GET /api/v1/contribution-plan": () => json(200, comparablePlan),
      "POST /api/v1/contribution-plan/preview": () => {
        previews.count += 1;

        return json(200, comparablePlan);
      },
    }),
  });
  const list = await screen.findByRole("table", { name: "Lista de compras" });

  return { list, previews };
}

describe("Contribution plan, indexer comparison (S409)", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("offers the comparison on a row bought by value and not on a row with units", async () => {
    const { list } = await openComparable();

    const buttons = await within(list).findAllByRole("button", {
      name: "comparar indexadores",
    });

    expect(buttons).toHaveLength(1);
    const rows = within(list).getAllByRole("row");
    expect(text(rows[1] ?? list)).toContain("Reserva");
    expect(
      within(rows[1] ?? list).getByRole("button", {
        name: "comparar indexadores",
      }),
    ).toBeInTheDocument();
    expect(text(rows[2] ?? list)).toContain("PETR4");
    expect(
      within(rows[2] ?? list).queryByRole("button"),
    ).not.toBeInTheDocument();
  });

  it("opens a dialog with the amount of the row", async () => {
    const { list } = await openComparable();
    const user = userEvent.setup();

    await user.click(
      await within(list).findByRole("button", { name: "comparar indexadores" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Comparar indexadores",
    });
    const amount = await within(dialog).findByRole("textbox", {
      name: "Valor aplicado",
    });
    expect(
      (amount as HTMLInputElement).value.replaceAll(
        String.fromCharCode(160),
        " ",
      ),
    ).toBe("1.000,00");
  });

  it("closes without changing the list or asking the preview again", async () => {
    const { list, previews } = await openComparable();
    const user = userEvent.setup();
    const before = within(list)
      .getAllByRole("row")
      .map((r) => text(r));
    const requests = previews.count;

    await user.click(
      await within(list).findByRole("button", { name: "comparar indexadores" }),
    );
    await screen.findByRole("dialog", { name: "Comparar indexadores" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      within(list)
        .getAllByRole("row")
        .map((r) => text(r)),
    ).toEqual(before);
    expect(previews.count).toBe(requests);
  });

  it("draws no button when no index has an expected path", async () => {
    const { list } = await openComparable(false);

    await waitFor(() => {
      expect(within(list).getAllByRole("row")).toHaveLength(4);
    });
    expect(
      within(list).queryByRole("button", { name: "comparar indexadores" }),
    ).not.toBeInTheDocument();
  });
});

const fundPlan = {
  ...plan,
  classes: [
    {
      name: "FIIs",
      target_bp: 10000,
      value: brl(300000),
      share_bp: 10000,
      amount: brl(100000),
      members: [
        {
          instrument: "HGLG11",
          target_bp: 5000,
          value: brl(300000),
          amount: brl(50000),
        },
        {
          account_id: "acc-1",
          target_bp: 5000,
          value: brl(0),
          amount: brl(50000),
        },
      ],
    },
  ],
};

const fundReport = {
  source: "br_cvm_fii",
  source_url: "https://dados.cvm.gov.br/dataset/fii-doc-inf_mensal",
  exchange: "B3SA",
  code: "HGLG11",
  currency: "BRL",
  identifier: "11728688000147",
  name: "CSHG Logística FII",
  segment: "Logística",
  periods: [
    {
      period: "2026-10-01",
      delivered: "2026-11-13",
      net_assets: 765689937148,
      holders: 633787,
      units: null,
      unit_book_value: "110.000000000000",
      admin_fee: "0.000465000000",
      month_yield: "0.010000000000",
      month_amortization: null,
    },
  ],
};

async function openFunds(stored = true) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      "GET /api/v1/contribution-plan": () => json(200, fundPlan),
      "POST /api/v1/contribution-plan/preview": () => json(200, fundPlan),
      "GET /api/v1/fund-reports": (req) =>
        json(200, {
          items:
            stored && new URL(req.url).searchParams.get("code") === "HGLG11"
              ? [fundReport]
              : [],
          candidates: [],
        }),
      "GET /api/v1/curves": () => json(200, { items: [] }),
      "GET /api/v1/prices": () => json(200, { interval: "day", items: [] }),
    }),
  });

  return screen.findByRole("table", { name: "Lista de compras" });
}

describe("Contribution plan, fund report", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("offers the report on the row of a fund with a stored report only", async () => {
    const list = await openFunds();

    const button = await within(list).findByRole("button", {
      name: "ver informe",
    });

    expect(
      within(list).getAllByRole("button", { name: "ver informe" }),
    ).toHaveLength(1);
    expect(text(within(list).getAllByRole("row")[2] ?? list)).toContain(
      "HGLG11",
    );
    expect(button.closest("tr")).toBe(within(list).getAllByRole("row")[2]);
  });

  it("opens the report in a dialog and removes the dialog on close", async () => {
    const list = await openFunds();
    const user = userEvent.setup();

    await user.click(
      await within(list).findByRole("button", { name: "ver informe" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Informe do fundo",
    });
    expect(
      await within(dialog).findByText("Valor patrimonial da cota"),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("draws no button when no code has a stored report", async () => {
    const list = await openFunds(false);

    await waitFor(() => {
      expect(within(list).getAllByRole("row").length).toBeGreaterThan(1);
    });
    expect(
      within(list).queryByRole("button", { name: "ver informe" }),
    ).not.toBeInTheDocument();
  });
});
