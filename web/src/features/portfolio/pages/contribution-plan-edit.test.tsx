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

    await userEvent.click(
      await screen.findByRole("button", { name: "Remover FIIs" }),
    );

    await waitFor(() => {
      expect(lastTargets()).toEqual([5000, 2500, 2500]);
    });
  });

  it("disables an entry of the picker that is already in the plan", async () => {
    await edit();
    const rows = within(
      await screen.findByRole("list", { name: "Carteira frente ao ideal" }),
    ).getAllByRole("listitem");

    await userEvent.click(
      within(rows.at(0) ?? document.body)
        .getAllByRole("button")
        .at(0) ?? document.body,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Adicionar ativo" }),
    );

    expect(
      await screen.findByRole("button", { name: /CDB Inter.*Em Renda fixa/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Poupança/ })).toBeEnabled();
  });

  it("filters the picker by the search field", async () => {
    await edit();
    const rows = within(
      await screen.findByRole("list", { name: "Carteira frente ao ideal" }),
    ).getAllByRole("listitem");
    await userEvent.click(
      within(rows.at(0) ?? document.body)
        .getAllByRole("button")
        .at(0) ?? document.body,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Adicionar ativo" }),
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
