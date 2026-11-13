import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { json } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const cls = (
  name: string,
  target: number,
  share: number,
  extra: Record<string, unknown> = {},
) => ({
  name,
  target_bp: target,
  value: brl(1000),
  share_bp: share,
  members: [],
  ...extra,
});

const plan = (amount: boolean) => ({
  status: "complete",
  ...(amount ? { amount: brl(400000), total_after: brl(2200000) } : {}),
  total: brl(1800000),
  drift_bp: 0,
  classes: [
    cls(
      "Renda fixa",
      4000,
      5555,
      amount ? { amount: brl(0), after_share_bp: 4600 } : {},
    ),
    cls("Ações exterior", 2000, 557, {
      ...(amount ? { amount: brl(300000), after_share_bp: 1818 } : {}),
    }),
    cls("Ações Brasil", 4000, 3888, {
      ...(amount ? { amount: brl(0) } : {}),
      members: [
        { instrument: "PETR4", value: brl(100), share_bp: 10000 },
        {
          instrument: "VALE3",
          value: brl(0),
          share_bp: 0,
          target_bp: 5000,
        },
      ],
    }),
  ],
  outside: [{ instrument: "BTCBRL" }],
  missing: [],
});

async function open(body: unknown) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
  await renderApp("/portfolio/contribution-plan", {
    fetch: portfolioApi({
      "GET /api/v1/contribution-plan": () => json(200, body),
      "POST /api/v1/contribution-plan/preview": () => json(200, body),
    }),
  });

  return screen.findByRole("list", { name: "Carteira frente ao ideal" });
}

const rowOf = (list: HTMLElement, name: string) =>
  within(list)
    .getAllByRole("listitem")
    .find((row) => row.textContent.startsWith(name)) ?? document.body;

describe("Contribution plan, portfolio against the ideal", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("writes what each group receives in words, never a dash", async () => {
    const list = await open(plan(true));

    await waitFor(() => {
      expect(rowOf(list, "Ações exterior")).toHaveTextContent(
        "recebe R$ 3.000,00",
      );
    });
    expect(rowOf(list, "Renda fixa")).toHaveTextContent("não recebe neste mês");
    expect(list).not.toHaveTextContent("—");
  });

  it("says in words where each group stands against its ideal", async () => {
    const list = await open(plan(true));

    expect(rowOf(list, "Renda fixa")).toHaveTextContent(
      "acima do ideal (hoje 56%, depois 46%, ideal 40%)",
    );
    expect(rowOf(list, "Ações exterior")).toHaveTextContent(
      "abaixo do ideal (hoje 5,6%, depois 18%, ideal 20%)",
    );
    expect(
      within(list).getByRole("img", {
        name: "Ações exterior: hoje 5,6%, depois do aporte 18%, ideal 20%",
      }),
    ).toBeInTheDocument();
  });

  it("draws every bar on one scale from 0 to 100%", async () => {
    const user = userEvent.setup();
    const list = await open(plan(false));

    await user.click(
      within(list).getByRole("button", {
        name: "Mostrar os ativos de Ações Brasil",
      }),
    );

    const fill = (name: RegExp) =>
      within(list)
        .getByRole("img", { name })
        .querySelector<HTMLElement>("[data-part='today']")?.style.inlineSize;
    expect(fill(/^Renda fixa:/)).toBe("55.55%");
    expect(fill(/^PETR4:/)).toBe("100%");
    expect(fill(/^VALE3:/)).toBe("0%");
  });

  it("hatches the change only for a group that receives money", async () => {
    const list = await open(plan(true));

    await waitFor(() => {
      expect(
        within(list)
          .getByRole("img", { name: /^Ações exterior:/ })
          .querySelector("[data-part='after']"),
      ).not.toBeNull();
    });
    expect(
      within(list)
        .getByRole("img", { name: /^Renda fixa:/ })
        .querySelector("[data-part='after']"),
    ).toBeNull();
  });

  it("names a member without an ideal of its own and draws no marker", async () => {
    const user = userEvent.setup();
    const list = await open(plan(false));

    await user.click(
      within(list).getByRole("button", {
        name: "Mostrar os ativos de Ações Brasil",
      }),
    );

    const row = rowOf(list, "PETR4");
    expect(row).toHaveTextContent("sem ideal próprio (hoje 100% do grupo)");
    expect(row.querySelector("[data-part='ideal']")).toBeNull();
    expect(rowOf(list, "VALE3")).toHaveTextContent(
      "abaixo do ideal (hoje 0%, ideal 50% do grupo)",
    );
  });

  it("writes no outcome without an amount", async () => {
    const list = await open(plan(false));

    expect(list).not.toHaveTextContent("recebe");
    expect(list).not.toHaveTextContent("não recebe");
  });

  it("keeps the positions outside the plan collapsed with their total", async () => {
    await open(plan(false));

    expect(
      await screen.findByRole("button", {
        name: "1 investimento fora do plano",
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
