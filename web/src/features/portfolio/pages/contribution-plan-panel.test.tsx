import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { json, problem } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

interface MemberBody {
  instrument: string;
  target_bp?: number;
  answers?: (boolean | null)[];
  answer_dates?: (string | null)[];
  answer_overrides?: boolean[];
  released?: boolean;
}

interface ClassBody {
  name: string;
  target_bp: number;
  questions?: string[];
  question_facts?: string[];
  question_limits?: string[];
  question_effects?: string[];
  question_reviews?: number[];
  members: MemberBody[];
}

interface Body {
  revision?: number;
  classes: ClassBody[];
}

const medo = "O ativo está em momento de queda e de medo do mercado?";
const crypto = (over: Partial<ClassBody> = {}): ClassBody => ({
  name: "Criptoativos",
  target_bp: 2000,
  questions: [medo],
  question_facts: [""],
  question_limits: [""],
  question_effects: ["hold"],
  question_reviews: [1],
  members: [
    {
      instrument: "ABTC11",
      answers: [false],
      answer_dates: ["2026-08-12"],
      answer_overrides: [false],
    },
  ],
  ...over,
});
const stocks: ClassBody = {
  name: "Ações",
  target_bp: 8000,
  members: [
    { instrument: "WEGE3", target_bp: 6000 },
    { instrument: "ITUB4", target_bp: 4000 },
  ],
};

// The server in memory: what it stores, and what each criterion does to the split of 1.000,00.
let stored: Body = { classes: [] };
let puts: Body[] = [];
let feeds: unknown[] = [];
let refuse: Response[] = [];
let indexEnabled = true;

function viewOf(body: Body, split: boolean) {
  const heldClass = (cls: ClassBody) =>
    cls.members.every((m) => heldBy(cls, m).length > 0 && m.released !== true);
  const ignored = body.classes.every((c) => heldClass(c));
  const free = body.classes
    .filter((c) => ignored || !heldClass(c))
    .reduce((sum, c) => sum + c.target_bp, 0);

  return {
    status: "complete",
    amount: brl(100000),
    total: brl(100000),
    ...(split ? { total_after: brl(200000) } : {}),
    revision: body.revision ?? 1,
    holds_ignored: ignored,
    outside: [],
    missing: [],
    classes: body.classes.map((cls) => {
      const amount =
        heldClass(cls) && !ignored
          ? 0
          : Math.round((100000 * cls.target_bp) / free);

      return {
        question_ideals: false,
        rules: [],
        matched: [],
        value: brl(0),
        share_bp: 0,
        questions: [],
        question_facts: [],
        question_limits: [],
        question_effects: [],
        question_reviews: [],
        ...cls,
        held: heldClass(cls),
        ...(split ? { amount: brl(amount) } : {}),
        members: cls.members.map((m) => ({
          ...m,
          value: brl(0),
          ...(cls.questions === undefined ? {} : factsOf(cls)),
          ...(heldBy(cls, m).length > 0 ? { held_by: heldBy(cls, m) } : {}),
          ...(heldBy(cls, m).length > 0 && m.released !== true
            ? { held: true, ...(split ? { forgone: brl(20000) } : {}) }
            : {}),
          ...(dueOf(cls, m).length > 0 ? { due: dueOf(cls, m) } : {}),
          ...(split
            ? {
                amount: brl(
                  Math.round((amount * (m.target_bp ?? 10000)) / 10000),
                ),
              }
            : {}),
        })),
      };
    }),
  };
}

function factsOf(cls: ClassBody) {
  const facts = cls.question_facts ?? [];

  return {
    fact_answers: facts.map((f, q) =>
      f !== "" && cls.question_limits?.[q] !== "" ? "yes" : "none",
    ),
    fact_details: facts.map((f, q) => {
      if (f === "") return {};

      return cls.question_limits?.[q] === ""
        ? { reason: "no_limit" }
        : { value: "13", date: "2026-11-25" };
    }),
  };
}

function heldBy(cls: ClassBody, m: MemberBody): number[] {
  return (cls.questions ?? [])
    .map((_, q) => q)
    .filter(
      (q) =>
        cls.question_effects?.[q] === "hold" &&
        m.answers?.[q] === false &&
        ((cls.question_facts?.[q] ?? "") === "" ||
          m.answer_overrides?.[q] === true),
    );
}

function dueOf(cls: ClassBody, m: MemberBody): number[] {
  return (cls.questions ?? [])
    .map((_, q) => q)
    .filter(
      (q) =>
        (cls.question_reviews?.[q] ?? 0) > 0 &&
        (m.answer_dates?.[q] ?? "9") < "2026-09-01",
    );
}

async function open(classes: ClassBody[], bookRole = "owner") {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  stored = { classes, revision: 1 };

  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "ana@example.com",
          role: "admin",
          language: "pt",
          region: "BR",
          books_id: 12,
          book_role: bookRole,
        }),
      "GET /api/v1/contribution-plan": () => json(200, viewOf(stored, false)),
      "POST /api/v1/contribution-plan/preview": async (req) =>
        json(
          200,
          viewOf(
            { ...((await req.json()) as Body), revision: stored.revision ?? 1 },
            true,
          ),
        ),
      "PUT /api/v1/contribution-plan": async (req) => {
        const body = (await req.clone().json()) as Body;
        puts.push(body);
        const refused = refuse.shift();
        if (refused !== undefined) return refused;

        stored = { ...body, revision: (stored.revision ?? 1) + 1 };

        return json(200, viewOf(stored, false));
      },
      "GET /api/v1/company-figures": () => json(200, { items: [] }),
      "GET /api/v1/fund-reports": () =>
        json(200, { items: [], candidates: [] }),
      "GET /api/v1/sentiment-indexes/crypto_fear_greed": () =>
        json(200, {
          id: "crypto_fear_greed",
          enabled: indexEnabled,
          value: 13,
          date: "2026-11-25",
          since: "2018-02-01",
          days: 4,
          counts: Array.from({ length: 101 }, (_, v) =>
            v === 10 || v === 60 || v === 61 || v === 62 ? 1 : 0,
          ),
        }),
      "GET /api/v1/market-data/feeds": () =>
        json(200, {
          items: [
            {
              id: "alternative_me",
              kind: "sentiment",
              enabled: indexEnabled,
              suggested: false,
              official: true,
              last: null,
              last_run: null,
              error: null,
              stale: false,
              covers: 0,
              history_pending: 0,
              missing: 0,
              activity: "idle",
              current: false,
            },
          ],
        }),
      "PUT /api/v1/market-data/feeds/alternative_me": async (req) => {
        feeds.push(await req.json());

        return json(200, { id: "alternative_me", enabled: true });
      },
    }),
  });

  return userEvent.setup();
}

const panel = (name: string) =>
  screen.findByRole("region", { name: `Critérios de ${name}` });
const row = (name: string) =>
  screen.findByRole("button", { name: new RegExp(`^${name}`) });
const text = (node: Element) =>
  node.textContent.replaceAll(String.fromCharCode(160), " ");
const lastClass = (name: string) =>
  puts.at(-1)?.classes.find((c) => c.name === name);

beforeEach(() => {
  puts = [];
  feeds = [];
  refuse = [];
  indexEnabled = true;
});

afterEach(() => {
  localStorage.removeItem("equori.locale");
});

describe("Contribution plan, the asset that waits", () => {
  it("opens on it, says where its money went and why it waits", async () => {
    await open([stocks, crypto()]);
    const region = await panel("ABTC11");

    expect(
      await within(region).findByText("Espera neste mês"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(text(region)).toContain("R$ 200,00 foram para os outros ativos");
    });
    expect(text(await row("ABTC11"))).toBe(
      "ABTC11Criptoativosvocê respondeu nãoesperarevisar",
    );
    expect(within(region).getByRole("radio", { name: "Não" })).toBeChecked();
    expect(
      within(region).getByText("Respondida em 12/08/2026"),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("Segura a compra · todo mês"),
    ).toBeInTheDocument();
  });

  it("answers in place and the purchases follow", async () => {
    const user = await open([stocks, crypto()]);
    const region = await panel("ABTC11");

    await user.click(within(region).getByRole("radio", { name: "Sim" }));

    expect(await within(region).findByText("Liberado")).toBeInTheDocument();
    expect(lastClass("Criptoativos")?.members[0]).toMatchObject({
      answers: [true],
      answer_overrides: [false],
    });
    expect(lastClass("Criptoativos")?.members[0]?.answer_dates?.[0]).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    expect(puts[0]?.revision).toBe(1);
    const buy = screen.getByRole("list", { name: "Comprar agora" });
    await waitFor(() => {
      expect(text(buy)).toContain("ABTC11");
    });
    expect(
      screen.queryByRole("list", { name: "Esperando" }),
    ).not.toBeInTheDocument();
    expect(await panel("ABTC11")).toBeInTheDocument();
  });

  it("is bought for the month in one press, and waits again in another", async () => {
    const user = await open([stocks, crypto()]);
    const region = await panel("ABTC11");

    await user.click(
      within(region).getByRole("button", { name: "Comprar mesmo assim" }),
    );
    expect(
      await within(region).findByText("Liberado só neste mês"),
    ).toBeInTheDocument();
    expect(lastClass("Criptoativos")?.members[0]?.released).toBe(true);
    expect(within(region).getByRole("radio", { name: "Não" })).toBeChecked();

    await user.click(
      within(region).getByRole("button", { name: "Voltar a esperar" }),
    );
    expect(
      await within(region).findByText("Espera neste mês"),
    ).toBeInTheDocument();
    expect(lastClass("Criptoativos")?.members[0]?.released).toBe(false);
  });

  it("renews an answer whose reminder is due", async () => {
    const user = await open([stocks, crypto()]);
    const region = await panel("ABTC11");

    expect(
      await within(region).findByText("Hora de revisar"),
    ).toBeInTheDocument();
    await user.click(
      within(region).getByRole("button", { name: "Continua valendo" }),
    );

    await waitFor(() => {
      expect(
        within(region).queryByText("Hora de revisar"),
      ).not.toBeInTheDocument();
    });
    expect(lastClass("Criptoativos")?.members[0]?.answers).toEqual([false]);
    expect(within(region).getByRole("radio", { name: "Não" })).toBeChecked();
  });

  it("says that every asset was waiting, and the list still buys", async () => {
    await open([crypto({ target_bp: 10000, question_reviews: [0] })]);

    expect(
      await screen.findByText(
        "Todos os ativos estavam esperando. Este aporte foi dividido sem as condições.",
      ),
    ).toBeInTheDocument();
    expect(text(await row("ABTC11"))).toContain("esperaria");
  });
});

describe("Contribution plan, the panel", () => {
  it("stays closed without an asset to answer for, and the list keeps every asset", async () => {
    await open([
      stocks,
      crypto({
        questions: [],
        question_facts: [],
        question_limits: [],
        question_effects: [],
        question_reviews: [],
        members: [{ instrument: "ABTC11" }],
      }),
    ]);
    const list = await screen.findByRole("list", { name: "Comprar agora" });

    expect(within(list).getAllByRole("button")).toHaveLength(3);
    expect(
      screen.queryByRole("region", { name: /^Critérios de/ }),
    ).not.toBeInTheDocument();
  });

  it("opens by keyboard, takes the focus and gives it back on Escape", async () => {
    const user = await open([stocks, crypto()]);
    await panel("ABTC11");
    const wege = await row("WEGE3");

    wege.focus();
    await user.keyboard("{Enter}");

    const region = await panel("WEGE3");
    expect(wege).toHaveAttribute("aria-expanded", "true");
    expect(region).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("region", { name: /^Critérios de/ }),
    ).not.toBeInTheDocument();
    expect(await row("WEGE3")).toHaveFocus();
  });

  it("closes from the row and from its own button", async () => {
    const user = await open([stocks, crypto()]);
    await panel("ABTC11");

    await user.click(await row("ABTC11"));
    expect(
      screen.queryByRole("region", { name: /^Critérios de/ }),
    ).not.toBeInTheDocument();

    await user.click(await row("ABTC11"));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("region", { name: /^Critérios de/ }),
    ).not.toBeInTheDocument();
  });

  it("leads to the answers that are due, and never holds the list", async () => {
    const user = await open([stocks, crypto()]);
    await panel("ABTC11");
    expect(
      screen.queryByRole("button", { name: "Revisar 1 resposta" }),
    ).not.toBeInTheDocument();

    await user.click(await row("WEGE3"));
    expect(screen.getByRole("button", { name: "Copiar lista" })).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: "Revisar 1 resposta" }),
    );

    expect(await panel("ABTC11")).toBeInTheDocument();
  });

  it("is only read by a member that cannot write", async () => {
    await open([stocks, crypto()], "read");
    const region = await panel("ABTC11");

    await waitFor(() => {
      expect(within(region).queryByRole("radio")).not.toBeInTheDocument();
    });
    expect(within(region).getByText("Não")).toBeInTheDocument();
    expect(
      within(region)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Fechar"]);
  });
});

describe("Contribution plan, a criterion edited in place", () => {
  async function edit(classes = [stocks, crypto()]) {
    const user = await open(classes);
    const region = await panel("ABTC11");
    await user.click(
      within(region).getByRole("button", { name: `Editar ${medo}` }),
    );

    return { user, region };
  }

  it("shows the whole question and saves it when the field loses the focus", async () => {
    const { user, region } = await edit();
    const field = within(region).getByRole("textbox", { name: "Pergunta" });

    expect(field).toHaveValue(medo);
    await user.clear(field);
    await user.type(field, "O bitcoin caiu?");
    expect(puts).toHaveLength(0);
    await user.tab();

    await waitFor(() => {
      expect(lastClass("Criptoativos")?.questions).toEqual(["O bitcoin caiu?"]);
    });
    expect(
      await within(region).findByRole("textbox", { name: "Pergunta" }),
    ).toHaveValue("O bitcoin caiu?");
  });

  it("goes back to the question on Escape and from a blank one, and stays open", async () => {
    const { user, region } = await edit();
    const field = within(region).getByRole("textbox", { name: "Pergunta" });

    await user.type(field, " mais");
    await user.keyboard("{Escape}");
    expect(field).toHaveValue(medo);

    await user.clear(field);
    await user.tab();
    expect(field).toHaveValue(medo);
    expect(puts).toHaveLength(0);
    expect(region).toBeInTheDocument();
  });

  it("turns a hold into a warning, and undoes it", async () => {
    const { user, region } = await edit();

    await user.click(within(region).getByRole("radio", { name: "Só avisa" }));
    await waitFor(() => {
      expect(lastClass("Criptoativos")?.question_effects).toEqual(["warn"]);
    });

    await user.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => {
      expect(lastClass("Criptoativos")?.question_effects).toEqual(["hold"]);
    });
    expect(puts.map((p) => p.revision)).toEqual([1, 2]);
  });

  it("sets the reminder", async () => {
    const { user, region } = await edit();

    await user.click(
      within(region).getByRole("combobox", { name: "Lembrete" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "A cada 3 meses" }),
    );

    await waitFor(() => {
      expect(lastClass("Criptoativos")?.question_reviews).toEqual([3]);
    });
    expect(region).toBeInTheDocument();
  });

  it("closes a list of choices on Escape and keeps the panel open", async () => {
    const { user, region } = await edit();

    await user.click(
      within(region).getByRole("combobox", { name: "Lembrete" }),
    );
    await screen.findByRole("option", { name: "A cada 3 meses" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
    });
    expect(await panel("ABTC11")).toBeInTheDocument();
  });

  it("removes the criterion, and undoes it", async () => {
    const { user, region } = await edit();

    await user.click(
      within(region).getByRole("button", { name: "Remover critério" }),
    );
    expect(await within(region).findByText("Sem critério")).toBeInTheDocument();
    expect(lastClass("Criptoativos")).toEqual({
      name: "Criptoativos",
      target_bp: 2000,
      members: [{ instrument: "ABTC11" }],
    });

    await user.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(
      await within(region).findByText("Espera neste mês"),
    ).toBeInTheDocument();
  });

  it("marks a question the group already has and does not send it", async () => {
    const two = crypto({
      questions: [medo, "Caiu?"],
      question_facts: ["", ""],
      question_limits: ["", ""],
      question_effects: ["hold", "warn"],
      question_reviews: [1, 0],
      members: [
        {
          instrument: "ABTC11",
          answers: [false, null],
          answer_dates: ["2026-08-12", null],
          answer_overrides: [false, false],
        },
      ],
    });
    const { user, region } = await edit([stocks, two]);
    const field = within(region).getByRole("textbox", { name: "Pergunta" });

    await user.clear(field);
    await user.type(field, "caiu? ");
    await user.tab();

    expect(
      within(region).getByText("Este critério já está no grupo."),
    ).toBeInTheDocument();
    expect(puts).toHaveLength(0);
  });
});

describe("Contribution plan, a new criterion", () => {
  const none = crypto({
    questions: [],
    question_facts: [],
    question_limits: [],
    question_effects: [],
    question_reviews: [],
    members: [{ instrument: "ABTC11" }],
  });

  it("opens from its button in a group that has criteria", async () => {
    const user = await open([stocks, crypto()]);
    const region = await panel("ABTC11");
    expect(
      within(region).queryByRole("textbox", { name: "Novo critério" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(region).getByRole("button", { name: "Adicionar critério" }),
    );

    expect(
      within(region).getByRole("textbox", { name: "Novo critério" }),
    ).toBeInTheDocument();
  });

  it("is written in one field and starts by only warning", async () => {
    const user = await open([stocks, none]);
    await user.click(await row("ABTC11"));
    const region = await panel("ABTC11");

    await user.type(
      within(region).getByRole("textbox", { name: "Novo critério" }),
      "O bitcoin caiu?{Enter}",
    );

    expect(
      await within(region).findByText("O bitcoin caiu?"),
    ).toBeInTheDocument();
    expect(lastClass("Criptoativos")).toMatchObject({
      questions: ["O bitcoin caiu?"],
      question_effects: ["warn"],
      question_reviews: [0],
      members: [{ answers: [null] }],
    });
    expect(text(await row("ABTC11"))).not.toContain("espera");
  });

  it("adds the index without a limit, turns its source on and then takes one", async () => {
    indexEnabled = false;
    const user = await open([stocks, none]);
    await user.click(await row("ABTC11"));
    const region = await panel("ABTC11");

    await user.click(
      await within(region).findByRole("button", {
        name: "Adicionar Crypto Fear & Greed até",
      }),
    );

    expect(
      await within(region).findByText("Escolha o limite"),
    ).toBeInTheDocument();
    expect(within(region).getByText("hoje 13")).toBeInTheDocument();
    expect(lastClass("Criptoativos")).toMatchObject({
      question_facts: ["crypto_fear_greed_max"],
      question_effects: ["warn"],
    });
    await waitFor(() => {
      expect(feeds).toEqual([{ enabled: true }]);
    });

    const field = within(region).getByRole("spinbutton", {
      name: "Comprar até",
    });
    await user.type(field, "25");
    await user.tab();

    await waitFor(() => {
      expect(lastClass("Criptoativos")?.question_limits).toEqual(["25"]);
    });
    expect(
      await within(region).findByText("25 ou menos: 25% dos dias"),
    ).toBeInTheDocument();

    await user.click(within(region).getByRole("button", { name: "Pronto" }));
    expect(
      await within(region).findByText("Crypto Fear & Greed até 25"),
    ).toBeInTheDocument();
    expect(within(region).getByText("Sim · 13")).toBeInTheDocument();
    expect(
      within(region).getByText(
        "Responde sozinho · alternative.me · 25/11/2026",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the source to an administrator and is added all the same", async () => {
    const user = await open([stocks, none]);
    await user.click(await row("ABTC11"));
    const region = await panel("ABTC11");

    await user.click(
      await within(region).findByRole("button", {
        name: "Adicionar Crypto Fear & Greed até",
      }),
    );

    await waitFor(() => {
      expect(puts).toHaveLength(1);
    });
    expect(feeds).toEqual([]);
  });
});

describe("Contribution plan, a criterion of a group", () => {
  const asked: ClassBody = {
    ...stocks,
    questions: ["Entendo?"],
    question_facts: [""],
    question_limits: [""],
    question_effects: ["warn"],
    question_reviews: [0],
    members: stocks.members.map((m) => ({
      ...m,
      answers: [null],
      answer_dates: [null],
      answer_overrides: [false],
    })),
  };

  it("is answered for every asset in one view", async () => {
    const user = await open([asked]);
    await user.click(await row("WEGE3"));
    const region = await panel("WEGE3");

    await user.click(
      within(region).getByRole("radio", { name: "Os 2 ativos" }),
    );
    await user.click(
      within(region).getByRole("button", { name: /^Entendo\?/ }),
    );
    const itub = within(region).getByRole("radiogroup", {
      name: "ITUB4: Entendo?",
    });
    await user.click(within(itub).getByRole("radio", { name: "Não" }));

    await waitFor(() => {
      expect(lastClass("Ações")?.members.map((m) => m.answers)).toEqual([
        [null],
        [false],
      ]);
    });
    expect(lastClass("Ações")?.members.map((m) => m.target_bp)).toEqual([
      6000, 4000,
    ]);
    expect(
      await within(region).findByText("0 sim · 1 não · 1 sem resposta"),
    ).toBeInTheDocument();
  });
});

describe("Contribution plan, a save of the panel (CO15)", () => {
  it("is made again over the plan that changed", async () => {
    refuse = [problem(409, "contribution_plan_changed")];
    const user = await open([stocks, crypto()]);
    const region = await panel("ABTC11");
    stored = {
      revision: 8,
      classes: [{ ...stocks, name: "Ações e ETFs" }, crypto()],
    };

    await user.click(within(region).getByRole("radio", { name: "Sim" }));

    expect(await within(region).findByText("Liberado")).toBeInTheDocument();
    expect(puts.map((p) => p.revision)).toEqual([1, 8]);
    expect(puts[1]?.classes.map((c) => c.name)).toEqual([
      "Ações e ETFs",
      "Criptoativos",
    ]);
  });

  it("says that the plan changed when the criterion is gone", async () => {
    refuse = [problem(409, "contribution_plan_changed")];
    const user = await open([stocks, crypto()]);
    const region = await panel("ABTC11");
    stored = {
      revision: 8,
      classes: [stocks, crypto({ questions: ["Outra?"] })],
    };

    await user.click(within(region).getByRole("radio", { name: "Sim" }));

    expect(
      await within(region).findByText(
        "O plano mudou em outro lugar. Esta tela já mostra a versão nova.",
      ),
    ).toBeInTheDocument();
    expect(await within(region).findByText("Outra?")).toBeInTheDocument();
    expect(puts).toHaveLength(1);
  });

  it("that fails is offered again", async () => {
    refuse = [problem(503, "unavailable")];
    const user = await open([stocks, crypto()]);
    const region = await panel("ABTC11");

    await user.click(within(region).getByRole("radio", { name: "Sim" }));
    await user.click(
      await within(region).findByRole("button", { name: "Tentar de novo" }),
    );

    expect(await within(region).findByText("Liberado")).toBeInTheDocument();
    expect(puts).toHaveLength(2);
  });
});
