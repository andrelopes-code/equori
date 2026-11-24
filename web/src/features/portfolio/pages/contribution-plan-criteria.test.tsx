import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { json } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

interface ClassBody {
  name: string;
  questions?: string[];
  question_facts?: string[];
  question_limits?: string[];
  members: { instrument: string; answers?: boolean[]; target_bp?: number }[];
}

interface Body {
  amount?: unknown;
  classes: ClassBody[];
}

const group = (over: Record<string, unknown> = {}) => ({
  name: "Ações",
  target_bp: 10000,
  value: brl(100000),
  share_bp: 10000,
  questions: [],
  question_facts: [],
  question_limits: [],
  question_ideals: false,
  rules: [],
  matched: [],
  members: [
    { instrument: "WEGE3", target_bp: 6000, value: brl(60000) },
    { instrument: "ITUB4", target_bp: 4000, value: brl(40000) },
  ],
  ...over,
});

const plan = (classes: unknown[]) => ({
  status: "complete",
  amount: brl(100000),
  total: brl(100000),
  drift_bp: 0,
  classes,
  outside: [],
  missing: [],
});

const answered = group({
  questions: ["Entendo o negócio?", "P/L de até"],
  question_facts: ["", "price_earnings_max"],
  question_limits: ["", "15"],
  question_ideals: true,
  members: [
    {
      instrument: "WEGE3",
      target_bp: 3333,
      value: brl(60000),
      answers: [true, false],
      fact_answers: ["none", "no"],
      fact_details: [{}, { value: "33.4057", date: "2026-09-30" }],
    },
    {
      instrument: "ITUB4",
      target_bp: 6667,
      value: brl(40000),
      answers: [true, false],
      fact_answers: ["none", "none"],
      fact_details: [{}, { reason: "shares" }],
    },
  ],
});

let previews: Body[] = [];
let puts: Body[] = [];

// The answer of the server to a draft: each automatic criterion answers yes for WEGE3.
function answerOf(body: Body) {
  return plan(
    body.classes.map((cls) => {
      const questions = cls.questions ?? [];
      const facts = cls.question_facts ?? questions.map(() => "");

      return group({
        name: cls.name,
        questions,
        question_facts: facts,
        question_limits: cls.question_limits ?? questions.map(() => ""),
        question_ideals: questions.length > 0,
        members: cls.members.map((m, at) => ({
          ...m,
          value: brl(50000),
          ...(questions.length > 0
            ? {
                target_bp: at === 0 ? 10000 : 0,
                fact_answers: facts.map((f) =>
                  f !== "" && at === 0 ? "yes" : "none",
                ),
                fact_details: facts.map((f) => {
                  if (f === "") return {};

                  return at === 0
                    ? { value: "8.9", date: "2026-09-30" }
                    : { reason: "no_report" };
                }),
              }
            : {}),
        })),
      });
    }),
  );
}

async function open(classes: unknown[]) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  const stored = plan(classes);

  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      "GET /api/v1/contribution-plan": () => json(200, stored),
      "POST /api/v1/contribution-plan/preview": async (req) => {
        const body = (await req.json()) as Body;
        previews.push(body);

        return json(
          200,
          body.classes[0]?.questions?.length ===
            (classes[0] as ClassBody).questions?.length
            ? { ...stored, total_after: brl(200000) }
            : answerOf(body),
        );
      },
      "PUT /api/v1/contribution-plan": async (req) => {
        puts.push((await req.clone().json()) as Body);

        return json(200, stored);
      },
      "GET /api/v1/company-figures": () => json(200, { items: [] }),
    }),
  });

  return userEvent.setup();
}

const board = () =>
  screen.findByRole("grid", { name: "Critérios por ativo de Ações" });

async function openBoard(classes: unknown[]) {
  const user = await open(classes);
  await user.click(
    await screen.findByRole("button", {
      name: /^(Abrir|Usar) critérios (de|em) Ações$/,
    }),
  );

  return user;
}

describe("Contribution plan, criteria", () => {
  beforeEach(() => {
    previews = [];
    puts = [];
  });

  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("offers the criteria on the main screen, with the state of each group", async () => {
    await open([answered, group({ name: "Exterior" })]);

    const list = await screen.findByRole("list", {
      name: "Critérios dos ativos",
    });
    const rows = within(list).getAllByRole("listitem");

    expect(rows[0]).toHaveTextContent("2 critérios, 1 automáticos");
    expect(
      within(rows[0] ?? list).getByRole("img", {
        name: "ITUB4 67%, WEGE3 33%",
      }),
    ).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("ideal digitado por ativo");
    expect(
      within(rows[1] ?? list).getByRole("button", {
        name: "Usar critérios em Exterior",
      }),
    ).toBeEnabled();
  });

  it("draws the figure of an automatic answer and the investor's where equori has none", async () => {
    await openBoard([answered]);
    const grid = await board();

    expect(
      within(grid).getByRole("columnheader", {
        name: "ideal de WEGE3 no grupo: 33%, 1 de 2 critérios",
      }),
    ).toBeInTheDocument();
    expect(
      within(grid).getByRole("img", {
        name: "WEGE3, P/L de até: não, 33,4, dado de 30/09/2026, respondido pelo equori",
      }),
    ).toHaveTextContent("não33,4");
    expect(
      within(grid).getByRole("button", {
        name: "ITUB4, P/L de até: não, sua resposta: número de ações não conferido",
      }),
    ).toHaveTextContent("nãosem dado");
    expect(
      within(grid).getByRole("button", {
        name: "WEGE3, Entendo o negócio?: sim",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("answers a criterion by pointer and by keyboard and sends it", async () => {
    const user = await openBoard([answered]);
    const grid = await board();

    const first = within(grid).getByRole("button", {
      name: "WEGE3, Entendo o negócio?: sim",
    });
    await user.click(first);
    expect(
      await within(grid).findByRole("button", {
        name: "WEGE3, Entendo o negócio?: não",
      }),
    ).toHaveAttribute("aria-pressed", "false");

    await user.keyboard("{ArrowRight} ");
    expect(
      await within(grid).findByRole("button", {
        name: "ITUB4, Entendo o negócio?: não",
      }),
    ).toHaveFocus();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(
      await within(grid).findByRole("button", {
        name: /^ITUB4, P\/L de até: sim/,
      }),
    ).toHaveFocus();

    await user.keyboard("{Home}");
    expect(
      within(grid).getByRole("img", { name: /^WEGE3, P\/L de até/ }),
    ).toHaveFocus();

    await waitFor(() => {
      expect(previews.at(-1)?.classes[0]?.members).toEqual([
        { instrument: "WEGE3", answers: [false, false] },
        { instrument: "ITUB4", answers: [false, true] },
      ]);
    });
  });

  it("keeps one tab stop among the cells", async () => {
    await openBoard([answered]);
    const grid = await board();

    const stops = [...grid.querySelectorAll('[role="gridcell"] > *')].filter(
      (cell) => cell.getAttribute("tabindex") === "0",
    );
    expect(stops).toHaveLength(1);
  });

  it("adds an automatic criterion, holds the save until its limit and answers it", async () => {
    const user = await openBoard([group()]);

    await user.click(
      await screen.findByRole("button", {
        name: "Escolher critérios automáticos",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Adicionar critério",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Adicionar P/L de até" }),
    );
    expect(within(dialog).getByText("no grupo")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Concluir" }));

    expect(await screen.findByText("defina o limite")).toBeVisible();
    expect(screen.getByText("Complete 1 critério para salvar")).toBeVisible();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    await user.type(
      screen.getByRole("spinbutton", { name: "Limite: P/L de até" }),
      "15",
    );
    await user.tab();

    expect(
      await screen.findByRole("img", {
        name: "WEGE3, P/L de até: sim, 8,9, dado de 30/09/2026, respondido pelo equori",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sem demonstrações: ITUB4. Nesses ativos a resposta é sua.",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => {
      expect(puts[0]?.classes[0]).toEqual({
        name: "Ações",
        target_bp: 10000,
        questions: ["P/L de até"],
        question_facts: ["price_earnings_max"],
        question_limits: ["15"],
        members: [
          { instrument: "WEGE3", answers: [false] },
          { instrument: "ITUB4", answers: [false] },
        ],
      });
    });
  });

  it("stores a percent limit as a fraction", async () => {
    const user = await openBoard([group()]);

    await user.click(
      await screen.findByRole("button", {
        name: "Escolher critérios automáticos",
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Adicionar ROE de ao menos" }),
    );
    await user.click(screen.getByRole("button", { name: "Concluir" }));
    await user.type(
      await screen.findByRole("spinbutton", {
        name: "Limite: ROE de ao menos",
      }),
      "12,5",
    );
    await user.tab();

    await waitFor(() => {
      expect(previews.at(-1)?.classes[0]?.question_limits).toEqual(["0.125"]);
    });
  });

  it("writes an own criterion in a focused field and leaves a blank one out of the preview", async () => {
    const user = await openBoard([group()]);

    await user.click(
      await screen.findByRole("button", { name: "Escrever um critério" }),
    );
    const field = await screen.findByRole("textbox", { name: "Critério 1" });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    await user.type(field, "Entendo?");
    await waitFor(() => {
      expect(previews.at(-1)?.classes[0]?.questions).toEqual(["Entendo?"]);
    });
    expect(previews.every((p) => p.classes[0]?.questions?.[0] !== "")).toBe(
      true,
    );
  });

  it("keeps the criteria of the group when another is added", async () => {
    const user = await openBoard([answered]);

    await user.click(
      await screen.findByRole("button", { name: "Adicionar critério" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Adicionar P/VP de até" }),
    );
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    const heads = within(await board()).getAllByRole("rowheader");
    expect(heads.map((head) => head.getAttribute("aria-label"))).toEqual([
      "Entendo o negócio?",
      "P/L de até",
      "P/VP de até",
    ]);
    expect(
      screen.getByRole("button", {
        name: "WEGE3, Entendo o negócio?: sim",
      }),
    ).toBeInTheDocument();
  });

  it("adds the nine signals at once", async () => {
    const user = await openBoard([group()]);

    await user.click(
      await screen.findByRole("button", {
        name: "Escolher critérios automáticos",
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Adicionar os nove" }),
    );
    expect(screen.getAllByText("no grupo")).toHaveLength(9);
    expect(
      screen.getByRole("button", { name: "Adicionar os nove" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(within(await board()).getAllByRole("rowheader")).toHaveLength(9);
    expect(screen.queryByText(/para salvar$/)).not.toBeInTheDocument();
  });

  it("goes back to the typed ideals with the derived ones, after asking", async () => {
    const user = await openBoard([answered]);

    await user.click(
      await screen.findByRole("button", { name: "Remover critérios" }),
    );
    const asked = await screen.findByRole("alertdialog");
    await user.click(
      within(asked).getByRole("button", { name: "Manter os critérios" }),
    );
    expect(await board()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover critérios" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Remover critérios",
      }),
    );

    await waitFor(() => {
      expect(previews.at(-1)?.classes[0]?.members).toEqual([
        { instrument: "WEGE3", target_bp: 3333 },
        { instrument: "ITUB4", target_bp: 6667 },
      ]);
    });
    expect(
      screen.getByRole("button", { name: "Escolher critérios automáticos" }),
    ).toBeVisible();
  });

  it("says a group without a yes receives its amount undivided", async () => {
    const user = await openBoard([
      group({
        questions: ["Entendo?"],
        question_facts: [""],
        question_limits: [""],
        members: [
          { instrument: "WEGE3", value: brl(60000), answers: [false] },
          { instrument: "ITUB4", value: brl(40000), answers: [false] },
        ],
      }),
    ]);

    expect(
      await screen.findByText(
        "Nenhum sim: o grupo recebe o valor sem divisão entre os ativos.",
      ),
    ).toBeVisible();

    await user.click(
      await screen.findByRole("button", { name: "Grupos e ideais" }),
    );
    expect(
      await screen.findByText("os ideais vêm dos critérios"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Abrir critérios" }));
    expect(await board()).toBeInTheDocument();
  });
});
