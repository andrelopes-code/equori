import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  cardID,
  cardRoutes,
  closedStatementID,
  foodID,
  money,
  openStatementID,
  statement,
  statementFixtures,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;
interface Sent {
  route: string;
  body?: unknown;
}

function api(sent: Sent[] = [], overrides: Record<string, Route> = {}) {
  const record = (route: string, answer: Response) => async (req: Request) => {
    sent.push({ route, body: await req.json() });
    return answer;
  };
  return fakeApi(
    accountRoutes({
      ...cardRoutes(),
      [`POST /api/v1/accounts/${cardID}/cards`]: record(
        "card",
        json(201, {
          id: "pc3",
          holder: "Bia",
          last_four: "5555",
          virtual: true,
          active: true,
        }),
      ),
      "PATCH /api/v1/cards/pc2": record("patch pc2", json(200, {})),
      [`POST /api/v1/accounts/${cardID}/billing-cycle-rules`]: record(
        "rule",
        json(201, {}),
      ),
      [`POST /api/v1/accounts/${cardID}/credit-limits`]: record(
        "limit",
        json(201, {}),
      ),
      "POST /api/v1/installment-purchases": record(
        "installments",
        json(201, {}),
      ),
      [`GET /api/v1/accounts/${cardID}/statement-placement`]: () =>
        json(200, {
          reference: "2026-11",
          closing_date: "2026-11-05",
          due_date: "2026-11-12",
        }),
      ...overrides,
    }),
  );
}

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

describe("CardPage", () => {
  it("reads the statement now, the next to pay, the free limit and what is committed", async () => {
    await renderApp(`/cards/${cardID}`, { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["card.figures"],
    });
    expect(await within(figures).findByText("R$2,500.00")).toBeInTheDocument();
    expect(within(figures).getByText("R$1,800.00")).toBeInTheDocument();
    expect(within(figures).getByText("R$5,500.00")).toBeInTheDocument();
    // December and January hold R$ 400,00 of installments each in the fixtures.
    expect(await within(figures).findByText("R$800.00")).toBeInTheDocument();
  });

  it("lists the statements and opens one", async () => {
    const { router } = await renderApp(`/cards/${cardID}`, { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["card.statements"],
    });
    await userEvent.click(
      await within(table).findByRole("link", { name: /October 2026/ }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/cards/${cardID}/statements/${closedStatementID}`,
      );
    });
  });

  it("reads earlier statements a year at a time", async () => {
    const froms: (string | null)[] = [];
    const { router } = await renderApp(`/cards/${cardID}`, {
      fetch: api([], {
        [`GET /api/v1/accounts/${cardID}/statements`]: (req) => {
          froms.push(new URL(req.url).searchParams.get("from"));
          return (
            cardRoutes()[`GET /api/v1/accounts/${cardID}/statements`]?.(req) ??
            json(200, { items: [] })
          );
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["card.earlier"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ from: "2024-10" });
    });
    await waitFor(() => {
      expect(froms).toContain("2024-10");
    });
  });

  it("adds a card and switches one off", async () => {
    const sent: Sent[] = [];
    await renderApp(`/cards/${cardID}?tab=cards`, { fetch: api(sent) });
    const table = await screen.findByRole("table", {
      name: catalogEn["card.plastics"],
    });
    await userEvent.click(
      within(await within(table).findByRole("row", { name: /9876/ })).getByRole(
        "switch",
      ),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["card.addCard"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["accountForm.holder"],
      }),
      "Bia",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["accountForm.lastFour"],
      }),
      "5555",
    );
    await userEvent.click(
      within(dialog).getByRole("switch", {
        name: catalogEn["accountForm.virtual"],
      }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["card.addCard"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "patch pc2", body: { active: false } },
        {
          route: "card",
          body: { holder: "Bia", last_four: "5555", virtual: true },
        },
      ]);
    });
  });

  it("adds a billing cycle version and a limit version", async () => {
    const sent: Sent[] = [];
    await renderApp(`/cards/${cardID}?tab=settings`, { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["card.newRule"] }),
    );
    const rule = await screen.findByRole("form", {
      name: catalogEn["card.newRule"],
    });
    await userEvent.click(
      within(rule).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["card.newLimit"] }),
    );
    const limit = await screen.findByRole("form", {
      name: catalogEn["card.newLimit"],
    });
    await userEvent.type(
      within(limit).getByRole("textbox", {
        name: catalogEn["accountForm.limit"],
      }),
      "1000000",
    );
    await userEvent.click(
      within(limit).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "rule",
          body: {
            effective_from: "2026-11",
            closing_mode: "day",
            closing_day: 5,
            due_day: 12,
            closing_adjustment: "none",
            due_date_adjustment: "following",
            closing_day_assignment: "next",
          },
        },
        {
          route: "limit",
          body: { effective_from: "2026-10-17", amount: money(1000000) },
        },
      ]);
    });
  });

  it("says where a purchase on a day is billed", async () => {
    await renderApp(`/cards/${cardID}?tab=settings`, { fetch: api() });
    expect(
      await screen.findByText(
        words("card.placement", {
          month: "November 2026",
          closing: "11/05/2026",
          due: "11/12/2026",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("asks for a billing cycle when the card has none", async () => {
    await renderApp(`/cards/${cardID}`, {
      fetch: api([], {
        [`GET /api/v1/accounts/${cardID}/billing-cycle-rules`]: () =>
          json(200, { items: [] }),
        [`GET /api/v1/accounts/${cardID}/statements`]: () =>
          json(200, { items: [] }),
        [`GET /api/v1/accounts/${cardID}/statement-placement`]: () =>
          problem(422, "validation_failed"),
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["card.setRule"] }),
    );
    expect(
      await screen.findByRole("form", { name: catalogEn["card.newRule"] }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["card.placementNoRule"]),
    ).toBeInTheDocument();
  });

  it("records a purchase in installments", async () => {
    const sent: Sent[] = [];
    await renderApp(`/cards/${cardID}`, { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["card.installmentPurchase"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["installments.description"],
      }),
      "Geladeira",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["installments.total"],
      }),
      "300000",
    );
    const category = within(dialog).getByRole("combobox", {
      name: catalogEn["installments.category"],
    });
    await userEvent.click(category);
    await userEvent.type(category, "Merc");
    await userEvent.click(
      await screen.findByRole("option", { name: /Mercado/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["installments.count"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "10" }));
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["installments.submit"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "installments",
          body: {
            card_account_id: cardID,
            date: "2026-10-17",
            description: "Geladeira",
            splits: [{ account_id: foodID, amount: money(300000) }],
            installment_count: 10,
          },
        },
      ]);
    });
  });

  it("lists the installment plans billed on the card and opens one", async () => {
    const withPlan = (base: unknown) => ({
      ...(base as object),
      postings: [
        {
          transaction_id: "tx9",
          date: "2026-09-02",
          description: "Geladeira",
          card_role: "charge",
          amount: money(-50000),
          installment: { plan_id: "plan9", number: 2, count: 4 },
        },
      ],
    });
    await renderApp(`/cards/${cardID}?tab=plans`, {
      fetch: api([], {
        [`GET /api/v1/statements/${openStatementID}`]: () =>
          json(200, withPlan(statementFixtures[1])),
        [`GET /api/v1/statements/${closedStatementID}`]: () =>
          json(200, withPlan(statementFixtures[0])),
        "GET /api/v1/installment-plans/plan9": () =>
          json(200, {
            id: "plan9",
            transaction_id: "tx9",
            account_id: cardID,
            status: "active",
            count: 4,
            installments: [
              {
                number: 1,
                statement: "2026-10",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 2,
                statement: "2026-11",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 3,
                statement: "2026-12",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 4,
                statement: "2027-01",
                amount: money(50000),
                reversed: false,
              },
            ],
          }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["plans.list"],
    });
    const row = (await within(table).findByText("Geladeira")).closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(
      cells.getByText(words("plans.progress", { billed: "2", count: "4" })),
    ).toBeInTheDocument();
    // Two installments of R$ 500,00 remain after the open statement of November.
    expect(cells.getByText("R$1,000.00")).toBeInTheDocument();
    await userEvent.click(
      cells.getByRole("button", {
        name: words("plans.openPlan", { name: "Geladeira" }),
      }),
    );
    const drawer = await screen.findByRole("dialog");
    expect(
      await within(drawer).findByRole("table", {
        name: catalogEn["plan.schedule"],
      }),
    ).toBeInTheDocument();
  });

  it("finds the plans on the statements around the open one, not the farthest ones", async () => {
    // Installments create statements years ahead; the plan below bills only up to December.
    const future = ["2026-12", "2027-01", "2027-02", "2027-03"].map((ref, i) =>
      statement(`f${String(i)}`, ref, "open"),
    );
    await renderApp(`/cards/${cardID}?tab=plans`, {
      fetch: api([], {
        [`GET /api/v1/accounts/${cardID}/statements`]: () =>
          json(200, { items: [...statementFixtures, ...future] }),
        [`GET /api/v1/statements/${openStatementID}`]: () =>
          json(200, {
            ...statementFixtures[1],
            postings: [
              {
                transaction_id: "tx8",
                date: "2026-10-20",
                description: "Sofá",
                card_role: "charge",
                amount: money(-20000),
                installment: { plan_id: "plan8", number: 2, count: 3 },
              },
            ],
          }),
        [`GET /api/v1/statements/${closedStatementID}`]: () =>
          json(200, { ...statementFixtures[0], postings: [] }),
        ...Object.fromEntries(
          future.map((f) => [
            `GET /api/v1/statements/${f.id}`,
            () => json(200, { ...f, postings: [] }),
          ]),
        ),
        "GET /api/v1/installment-plans/plan8": () =>
          json(200, {
            id: "plan8",
            transaction_id: "tx8",
            account_id: cardID,
            status: "active",
            count: 3,
            installments: [
              {
                number: 1,
                statement: "2026-10",
                amount: money(20000),
                reversed: false,
              },
              {
                number: 2,
                statement: "2026-11",
                amount: money(20000),
                reversed: false,
              },
              {
                number: 3,
                statement: "2026-12",
                amount: money(20000),
                reversed: false,
              },
            ],
          }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["plans.list"],
    });
    expect(await within(table).findByText("Sofá")).toBeInTheDocument();
  });
});
