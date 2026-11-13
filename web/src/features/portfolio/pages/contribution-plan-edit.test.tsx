import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { json, problem } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const cdbID = "d0000000-0000-4000-8000-000000000001";
const savingsID = "d0000000-0000-4000-8000-000000000002";

const accountItems = [
  {
    id: cdbID,
    name: "CDB Inter",
    class: "asset",
    kind: "savings",
    currency: "BRL",
  },
  {
    id: savingsID,
    name: "Poupança",
    class: "asset",
    kind: "savings",
    currency: "BRL",
  },
];

const cls = (name: string, target: number, members: unknown[] = []) => ({
  name,
  target_bp: target,
  value: brl(100000),
  share_bp: 2500,
  members,
});

// S398: four classes at 40, 20, 20 and 20 percent; the first holds one account.
const saved = {
  status: "complete",
  amount: brl(400000),
  total: brl(1800000),
  drift_bp: 0,
  classes: [
    cls("Renda fixa", 4000, [{ account_id: cdbID, value: brl(100000) }]),
    cls("Ações Brasil", 2000),
    cls("Ações exterior", 2000),
    cls("FIIs", 2000),
  ],
  outside: [],
  missing: [],
};

interface Body {
  amount?: unknown;
  classes: { name: string; target_bp: number; members: unknown[] }[];
}

let previews: Body[] = [];
let puts: Body[] = [];

const api = (put = () => json(200, saved)) =>
  portfolioApi({
    "GET /api/v1/contribution-plan": () => json(200, saved),
    "GET /api/v1/accounts": () => json(200, { items: accountItems }),
    "POST /api/v1/contribution-plan/preview": async (req) => {
      previews.push((await req.json()) as Body);
      return json(200, { ...saved, total_after: brl(2200000) });
    },
    "PUT /api/v1/contribution-plan": async (req) => {
      puts.push((await req.clone().json()) as Body);
      return put();
    },
  });

const lastTargets = () => previews.at(-1)?.classes.map((c) => c.target_bp);

async function edit(fetch = api()) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  await renderApp("/portfolio/contribution-plan", { fetch });
  await userEvent.click(
    await screen.findByRole("button", {
      name: catalogPtBR["contributionPlan.edit"],
    }),
  );
}

const menuOf = (name: string) =>
  screen.findByRole("button", { name: `Ações de ${name}` });

const target = (name: string) =>
  screen.findByRole("textbox", { name: `Ideal: ${name}` });

describe("Contribution plan edit mode", () => {
  beforeEach(() => {
    previews = [];
    puts = [];
  });

  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("draws the bar key only outside edit mode and puts the rules in a help popover", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp("/portfolio/contribution-plan", { fetch: api() });
    expect(await screen.findByText("hoje")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: catalogPtBR["contributionPlan.helpLabel"],
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: catalogPtBR["contributionPlan.edit"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogPtBR["contributionPlan.helpLabel"],
      }),
    );

    expect(
      await screen.findByText(catalogPtBR["contributionPlan.help"]),
    ).toBeInTheDocument();
    expect(screen.queryByText("hoje")).not.toBeInTheDocument();
  });

  it("names the columns of the group list in edit mode only", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp("/portfolio/contribution-plan", { fetch: api() });
    await screen.findByText("hoje");
    expect(screen.queryByText("Grupo")).not.toBeInTheDocument();
    expect(screen.queryByText("Recebe")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: catalogPtBR["contributionPlan.edit"],
      }),
    );
    const list = within(
      await screen.findByRole("list", {
        name: catalogPtBR["contributionPlan.ideal"],
      }),
    );

    expect(
      ["Grupo", "Ideal", "Hoje", "Recebe"].map((text) => list.getByText(text)),
    ).toHaveLength(4);
  });

  it("keeps only the amount row in the month card while editing", async () => {
    await edit();

    expect(
      await screen.findByRole("textbox", { name: "Aporte" }),
    ).toBeVisible();
    expect(
      screen.queryByText(catalogPtBR["contributionPlan.shoppingEmpty"]),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: catalogPtBR["contributionPlan.shopping"],
      }),
    ).not.toBeInTheDocument();
  });

  it("steps a target by one percent with the buttons", async () => {
    await edit();

    await userEvent.click(
      await screen.findByRole("button", { name: "Aumentar Ações Brasil" }),
    );
    await waitFor(() => {
      expect(lastTargets()).toEqual([3950, 2100, 1975, 1975]);
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Diminuir Ações Brasil" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Diminuir Ações Brasil" }),
    );
    await waitFor(() => {
      expect(lastTargets()).toEqual([4050, 1900, 2025, 2025]);
    });
  });

  it("spreads a slider change of a row over the others and keeps the field in sync", async () => {
    await edit();

    const slider = await screen.findByRole("slider", {
      name: "Ideal: Ações Brasil",
    });
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    await waitFor(() => {
      expect(lastTargets()).toEqual([3995, 2010, 1997, 1998]);
    });
    expect(await target("Ações Brasil")).toHaveValue("20,1");
  });

  it("moves a boundary of the ideal bar between its two groups only", async () => {
    await edit();

    const handle = await screen.findByRole("slider", {
      name: /Renda fixa.*Ações Brasil/,
    });
    fireEvent.keyDown(handle, { key: "ArrowRight" });

    await waitFor(() => {
      expect(lastTargets()).toEqual([4100, 1900, 2000, 2000]);
    });
  });

  it("marks a blank name on the input and in the contribution bar only", async () => {
    await edit();

    const name = await screen.findByDisplayValue("Ações exterior");
    await userEvent.clear(name);

    expect(
      await screen.findByRole("img", {
        name: /Este aporte: dê um nome a cada grupo/,
      }),
    ).toBeInTheDocument();
    expect(name).toBeInvalid();
    expect(
      screen.queryByText("Dê um nome a cada grupo antes de salvar."),
    ).not.toBeInTheDocument();
  });

  it("offers the split, the picker and the removal in the menu of a group", async () => {
    await edit();

    await userEvent.click(await menuOf("Renda fixa"));

    expect(
      await screen.findByRole("menuitemcheckbox", {
        name: "Dividir entre ativos",
      }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("menuitem", { name: "Adicionar ativo" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Remover grupo" }),
    ).toBeVisible();
  });

  it("gives a member its own percent field when the group is split", async () => {
    await edit();
    expect(
      screen.queryByRole("textbox", { name: "Ideal: CDB Inter" }),
    ).not.toBeInTheDocument();

    await userEvent.click(await menuOf("Renda fixa"));
    await userEvent.click(
      await screen.findByRole("menuitemcheckbox", {
        name: "Dividir entre ativos",
      }),
    );

    expect(await target("CDB Inter")).toHaveValue("100,0");
  });

  it("spreads a class change over the others and previews the draft", async () => {
    await edit();

    fireEvent.change(await target("Ações Brasil"), { target: { value: "30" } });

    await waitFor(() => {
      expect(lastTargets()).toEqual([3500, 3000, 1750, 1750]);
    });
  });

  it("keeps a locked class at its target", async () => {
    await edit();

    const lock = await screen.findByRole("button", {
      name: "Manter Renda fixa fixo",
      pressed: false,
    });
    await userEvent.click(lock);
    fireEvent.change(await target("Ações Brasil"), { target: { value: "30" } });

    await waitFor(() => {
      expect(lastTargets()).toEqual([4000, 3000, 1500, 1500]);
    });
    expect(lock).toHaveAttribute("aria-pressed", "true");
  });

  it("gives the target of a removed class to the others", async () => {
    await edit();

    await userEvent.click(await menuOf("FIIs"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remover grupo" }),
    );

    await waitFor(() => {
      expect(lastTargets()).toEqual([5000, 2500, 2500]);
    });
  });

  it("disables an entry of the picker that is already in the plan", async () => {
    await edit();
    await userEvent.click(await menuOf("Renda fixa"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Adicionar ativo" }),
    );

    expect(
      await screen.findByRole("button", { name: /CDB Inter.*Em Renda fixa/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Poupança/ })).toBeEnabled();
  });

  it("filters the picker by the search field", async () => {
    await edit();
    await userEvent.click(await menuOf("Renda fixa"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Adicionar ativo" }),
    );

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Buscar ativos" }),
      "poup",
    );

    const dialog = within(screen.getByRole("dialog"));

    expect(dialog.getByRole("button", { name: /^Poupança/ })).toBeVisible();
    expect(
      dialog.queryByRole("button", { name: /CDB Inter/ }),
    ).not.toBeInTheDocument();
  });

  it("saves the input body of the draft", async () => {
    await edit();

    fireEvent.change(await target("Ações Brasil"), { target: { value: "30" } });
    const amount = await screen.findByRole("textbox", { name: "Aporte" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "5000,00");
    await userEvent.click(
      await screen.findByRole("button", { name: "Salvar" }),
    );

    await waitFor(() => {
      expect(puts).toEqual([
        {
          amount: brl(500000),
          classes: [
            {
              name: "Renda fixa",
              target_bp: 3500,
              members: [{ account_id: cdbID }],
            },
            { name: "Ações Brasil", target_bp: 3000, members: [] },
            { name: "Ações exterior", target_bp: 1750, members: [] },
            { name: "FIIs", target_bp: 1750, members: [] },
          ],
        },
      ]);
    });
  });

  it("shows the words of a problem the save returns", async () => {
    await edit(api(() => problem(422, "contribution_class_name_duplicate")));

    fireEvent.change(await target("Ações Brasil"), { target: { value: "30" } });
    await userEvent.click(
      await screen.findByRole("button", { name: "Salvar" }),
    );

    expect(
      await screen.findByText(
        catalogPtBR["problem.contribution_class_name_duplicate"],
      ),
    ).toBeInTheDocument();
  });

  it("asks before leaving with a draft", async () => {
    await edit();

    fireEvent.change(await target("Ações Brasil"), { target: { value: "30" } });
    await userEvent.click(
      screen
        .getAllByRole("link", {
          name: catalogPtBR["nav.portfolio"],
        })
        .at(0) ?? document.body,
    );

    expect(
      await screen.findByText(catalogPtBR["contributionPlan.leaveTitle"]),
    ).toBeInTheDocument();
  });
});
