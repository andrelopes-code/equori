import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
import { json } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

// S409: PETR4 at R$ 30,01 a unit receives 33 units for R$ 990,33 out of R$ 1.000,00 and R$ 9,67
// stay as the leftover; FIIs is a class of two assets without member targets.
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
      questions: [],
      question_ideals: false,
      question_facts: [],
      question_limits: [],
      question_effects: [],
      question_reviews: [],
      held: false,
      rules: [],
      matched: [],
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
      questions: [],
      question_ideals: false,
      question_facts: [],
      question_limits: [],
      question_effects: [],
      question_reviews: [],
      held: false,
      rules: [],
      matched: [],
      value: brl(300000),
      share_bp: 5000,
      amount: brl(100000),
      cost: brl(100000),
      members: [
        { instrument: "MXRF11", value: brl(150000) },
        { instrument: "HGLG11", value: brl(150000) },
      ],
    },
  ],
  outside: [],
  missing: [],
  revision: 1,
  holds_ignored: false,
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

  return screen.findByRole("list", { name: "Comprar agora" });
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
      expect(within(list).getAllByRole("listitem").map(text)).toEqual([
        "FIIsvalor do grupo, sem divisãoR$ 1.000,0050%",
        "PETR4Ações Brasil≈ 33 cotas × R$ 30,01R$ 990,3350%",
        "Sobrafica na contaR$ 9,670,5%",
      ]);
    });
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
        name: "Dividir entre os ativos",
      }),
    ).not.toBeInTheDocument();
  });

  it.each([
    { how: "a click", act: "{MouseLeft}" },
    { how: "Enter", act: "{Enter}" },
    { how: "Space", act: " " },
  ])(
    "opens the assets of the group from the panel of the group by $how",
    async ({ act }) => {
      await open();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /^FIIs/ }));
      const action = await screen.findByRole("button", {
        name: "Dividir entre os ativos",
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
        screen.getByRole("button", { name: "Ativos (2)", expanded: true }),
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
      questions: [],
      question_ideals: false,
      question_facts: [],
      question_limits: [],
      question_effects: [],
      question_reviews: [],
      held: false,
      rules: [],
      matched: [],
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
  const list = await screen.findByRole("list", { name: "Comprar agora" });

  return { list, previews };
}

describe("Contribution plan, indexer comparison (S409)", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("offers the comparison of a row bought by value and not of a row with units", async () => {
    await openComparable();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Reserva/ }));
    expect(
      await screen.findByRole("button", { name: "comparar indexadores" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^PETR4/ }));
    expect(
      screen.queryByRole("button", { name: "comparar indexadores" }),
    ).not.toBeInTheDocument();
  });

  it("opens a dialog with the amount of the row", async () => {
    await openComparable();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Reserva/ }));
    await user.click(
      await screen.findByRole("button", { name: "comparar indexadores" }),
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

  it("closes without changing the list, the panel or asking the preview again", async () => {
    const { list, previews } = await openComparable();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Reserva/ }));
    const before = within(list).getAllByRole("listitem").map(text);
    const action = await screen.findByRole("button", {
      name: "comparar indexadores",
    });
    const requests = previews.count;
    await user.click(action);
    await screen.findByRole("dialog", { name: "Comparar indexadores" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(within(list).getAllByRole("listitem").map(text)).toEqual(before);
    expect(
      await screen.findByRole("region", { name: "Critérios de Reserva" }),
    ).toBeInTheDocument();
    expect(previews.count).toBe(requests);
  });

  it("draws no button when no index has an expected path", async () => {
    await openComparable(false);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Reserva/ }));
    await screen.findByRole("region", { name: "Critérios de Reserva" });

    expect(
      screen.queryByRole("button", { name: "comparar indexadores" }),
    ).not.toBeInTheDocument();
  });
});

const fundPlan = {
  ...plan,
  classes: [
    {
      name: "FIIs",
      target_bp: 10000,
      questions: [],
      question_ideals: false,
      question_facts: [],
      question_limits: [],
      question_effects: [],
      question_reviews: [],
      held: false,
      rules: [],
      matched: [],
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

  return screen.findByRole("list", { name: "Comprar agora" });
}

describe("Contribution plan, fund report", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("offers the report of a fund with a stored report only", async () => {
    await openFunds();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^HGLG11/ }));
    expect(
      await screen.findByRole("button", { name: "ver informe" }),
    ).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Comprar agora" });
    const account = within(list)
      .getAllByRole("button")
      .find((b) => !text(b).startsWith("HGLG11"));
    await user.click(account ?? list);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "ver informe" }),
      ).not.toBeInTheDocument();
    });
  });

  it("opens the report in a dialog and removes the dialog on close", async () => {
    await openFunds();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^HGLG11/ }));
    await user.click(
      await screen.findByRole("button", { name: "ver informe" }),
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
    await openFunds(false);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^HGLG11/ }));
    await screen.findByRole("region", { name: "Critérios de HGLG11" });

    expect(
      screen.queryByRole("button", { name: "ver informe" }),
    ).not.toBeInTheDocument();
  });
});

const stockPlan = {
  ...plan,
  classes: [
    {
      name: "Ações",
      target_bp: 10000,
      questions: ["P/L", "Entendo o negócio?"],
      question_facts: ["price_earnings_max", ""],
      question_limits: ["15", ""],
      question_ideals: true,
      question_effects: [],
      question_reviews: [],
      held: false,
      rules: [],
      matched: [],
      value: brl(300000),
      share_bp: 10000,
      amount: brl(100000),
      members: [
        {
          instrument: "WEGE3",
          target_bp: 5000,
          answers: [false, true],
          fact_answers: ["no", "none"],
          fact_details: [{ value: "33.4", date: "2026-09-30" }, {}],
          value: brl(300000),
          amount: brl(60000),
        },
        {
          instrument: "BOVA11",
          target_bp: 5000,
          answers: [false, false],
          fact_answers: ["none", "none"],
          fact_details: [{ reason: "no_report" }, {}],
          value: brl(0),
          amount: brl(40000),
        },
      ],
    },
  ],
};

const companyFigures = {
  source: "br_cvm_cia",
  source_url: "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp",
  name: "WEG S.A.",
  currency: "BRL",
  price_date: "2026-11-20",
  price_earnings: { value: "33.4", date: "2026-09-30" },
  price_book: { reason: "shares" },
  return_on_equity: { value: "0.31", date: "2026-09-30" },
  net_margin: { value: "0.16", date: "2026-09-30" },
  net_debt_to_equity: { value: "-0.12", date: "2026-09-30" },
  gross_profit_to_assets: { value: "0.29", date: "2026-09-30" },
  current_ratio: { value: "1.5", date: "2026-09-30" },
  revenue_growth: { reason: "short_history" },
  positive_years: { positive: 5, years: 5 },
  profit: { state: "rate", rate: "-0.18", date: "2026-09-30", months: 9 },
  revenue: { state: "rate", rate: "0.03", date: "2026-09-30", months: 9 },
};

async function openStocks(stored = true) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      "GET /api/v1/contribution-plan": () => json(200, stockPlan),
      "POST /api/v1/contribution-plan/preview": () => json(200, stockPlan),
      "GET /api/v1/company-figures": (req) =>
        json(200, {
          items:
            stored && new URL(req.url).searchParams.get("code") === "WEGE3"
              ? [companyFigures]
              : [],
        }),
    }),
  });

  return screen.findByRole("list", { name: "Comprar agora" });
}

describe("Contribution plan, company of a purchase", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("states the change of the profit of a company, without a tone", async () => {
    await openStocks();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^WEGE3/ }));
    expect(await screen.findByText("caiu 18%")).toBeInTheDocument();
    expect(screen.getByText("Lucro no ano")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^BOVA11/ }));
    expect(screen.queryByText("Lucro no ano")).not.toBeInTheDocument();
  });

  it("states the points and the ideal of an asset of a group with criteria", async () => {
    await openStocks();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^WEGE3/ }));
    expect(
      await screen.findByText("1 de 2 pontos · ideal 50% do grupo"),
    ).toBeInTheDocument();
  });

  it("opens the statements in a dialog", async () => {
    await openStocks();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^WEGE3/ }));
    await user.click(
      await screen.findByRole("button", { name: "ver demonstrações" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Demonstrações de WEGE3" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
