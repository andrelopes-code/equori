import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  cardID,
  cardRoutes,
  checkingID,
  closedStatementID,
  money,
  openStatementID,
  statementFixtures,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

interface Sent {
  route: string;
  body?: unknown;
}

const closed = statementFixtures[0];
const open = statementFixtures[1];

function detail(base: unknown, over: Record<string, unknown> = {}) {
  return {
    ...(base as object),
    postings: [
      {
        transaction_id: "tx1",
        date: "2026-09-20",
        description: "Mercado",
        card_role: "charge",
        amount: money(-30000),
      },
      {
        transaction_id: "tx2",
        date: "2026-09-20",
        description: "Geladeira",
        card_role: "charge",
        amount: money(-150000),
        installment: { plan_id: "plan1", number: 2, count: 10 },
      },
      {
        transaction_id: "tx3",
        date: "2026-09-25",
        description: "Pagamento",
        card_role: "payment",
        amount: money(90000),
      },
    ],
    ...over,
  };
}

function api(sent: Sent[] = [], overrides: Record<string, Route> = {}) {
  const record =
    (route: string, answer: () => Response) => async (req: Request) => {
      const text = await req.text();
      sent.push({
        route,
        ...(text === "" ? {} : { body: JSON.parse(text) as unknown }),
      });
      return answer();
    };
  return fakeApi(
    accountRoutes({
      ...cardRoutes(),
      [`GET /api/v1/statements/${closedStatementID}`]: () =>
        json(200, detail(closed)),
      [`GET /api/v1/statements/${openStatementID}`]: () =>
        json(200, detail(open)),
      [`POST /api/v1/statements/${closedStatementID}/payments`]: record(
        "pay",
        () => json(201, {}),
      ),
      [`POST /api/v1/statements/${closedStatementID}/financing`]: record(
        "finance",
        () => json(201, {}),
      ),
      [`POST /api/v1/statements/${closedStatementID}/reconcile`]: record(
        "reconcile",
        () => json(200, detail(closed, { reconciled: true })),
      ),
      [`PUT /api/v1/statements/${closedStatementID}/facts`]: record(
        "facts",
        () => json(200, detail(closed)),
      ),
      [`DELETE /api/v1/statements/${closedStatementID}/facts`]: record(
        "remove facts",
        () => new Response(null, { status: 204 }),
      ),
      ...overrides,
    }),
  );
}

const path = `/cards/${cardID}/statements/${closedStatementID}`;

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

async function action(key: keyof typeof catalogEn) {
  await userEvent.click(
    await screen.findByRole("button", { name: catalogEn[key] }),
  );
  return screen.findByRole("dialog");
}

describe("StatementPage", () => {
  it("reads the statement's figures and how its total is made", async () => {
    await renderApp(path, { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["statement.figures"],
    });
    // The previous balance and the payments are both R$ 900,00.
    expect(await within(figures).findAllByText("R$900.00")).toHaveLength(2);
    expect(
      screen.getByText(
        words("statement.breakdown", {
          opening: "R$900.00",
          charges: "R$1,800.00",
          credits: "R$0.00",
          payments: "R$900.00",
          total: "R$1,800.00",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("compares the total with what the institution reported", async () => {
    await renderApp(path, {
      fetch: api([], {
        [`GET /api/v1/statements/${closedStatementID}`]: () =>
          json(
            200,
            detail(closed, {
              institution: {
                source: "aggregator",
                due_date: "2026-10-25",
                total: money(185000),
                minimum: money(20000),
              },
              amount_difference: money(-5000),
            }),
          ),
      }),
    });
    expect(
      await screen.findByText(
        words("statement.institution", {
          total: "R$1,850.00",
          difference: "−R$50.00",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("lists the lines by day with their installment", async () => {
    await renderApp(path, { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["statement.lines"],
    });
    const row = await within(table).findByRole("row", { name: /Geladeira/ });
    expect(within(row).getByText("2/10")).toBeInTheDocument();
    expect(
      within(table).getAllByRole("row", {
        name: /Mercado|Geladeira|Pagamento/,
      }),
    ).toHaveLength(3);
  });

  it("marks a line the bank has not reported", async () => {
    await renderApp(path, {
      fetch: api([], {
        [`GET /api/v1/accounts/${cardID}/unconfirmed`]: () =>
          json(200, {
            items: [
              {
                transaction_id: "tx2",
                date: "2026-10-03",
                amount: { amount: -100000, currency: "BRL" },
                description: "Geladeira",
                statement_id: closedStatementID,
              },
            ],
          }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["statement.lines"],
    });
    const row = await within(table).findByRole("row", { name: /Geladeira/ });
    expect(await within(row).findByText("No bank line")).toBeInTheDocument();
    expect(
      within(within(table).getByRole("row", { name: /Mercado/ })).queryByText(
        "No bank line",
      ),
    ).toBeNull();
  });

  it("steps to the next statement", async () => {
    const { router } = await renderApp(path, { fetch: api() });
    await userEvent.click(
      await screen.findByRole("link", { name: catalogEn["statement.next"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/cards/${cardID}/statements/${openStatementID}`,
      );
    });
  });

  it("offers what a closed statement allows and only payment and facts on an open one", async () => {
    await renderApp(path, { fetch: api() });
    for (const key of [
      "statement.pay",
      "statement.finance",
      "statement.reconcile",
      "statement.facts",
    ] as const) {
      expect(
        await screen.findByRole("button", { name: catalogEn[key] }),
      ).toBeInTheDocument();
    }
    await renderApp(`/cards/${cardID}/statements/${openStatementID}`, {
      fetch: api(),
    });
    await screen.findAllByRole("button", { name: catalogEn["statement.pay"] });
  });

  it("pays what is open from a balance account", async () => {
    const sent: Sent[] = [];
    await renderApp(`${path}?pay=true`, { fetch: api(sent) });
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      await within(dialog).findByRole("radio", { name: /Nubank/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["pay.submit"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "pay",
          body: {
            date: "2026-10-17",
            from_account_id: checkingID,
            amount: money(180000),
          },
        },
      ]);
    });
  });

  it("finances what is open in installments and states the interest", async () => {
    const sent: Sent[] = [];
    await renderApp(path, { fetch: api(sent) });
    const dialog = await action("statement.finance");
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["finance.installment"],
      }),
      "20000",
    );
    expect(
      within(dialog).getByText(
        words("finance.interest", {
          total: "R$2,000.00",
          interest: "R$200.00",
        }),
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["finance.submit"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "finance",
          body: {
            date: "2026-10-17",
            installment_count: 10,
            installment_amount: money(20000),
          },
        },
      ]);
    });
  });

  it("says a statement still open cannot be financed", async () => {
    await renderApp(path, {
      fetch: api([], {
        [`POST /api/v1/statements/${closedStatementID}/financing`]: () =>
          problem(409, "statement_not_closed"),
      }),
    });
    const dialog = await action("statement.finance");
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["finance.installment"],
      }),
      "20000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["finance.submit"] }),
    );
    expect(
      await within(dialog).findByText(
        catalogEn["problem.statement_not_closed"],
      ),
    ).toBeInTheDocument();
  });

  it("reconciles the statement with the institution's total", async () => {
    const sent: Sent[] = [];
    await renderApp(path, { fetch: api(sent) });
    const dialog = await action("statement.reconcile");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["reconcileStatement.submit"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "reconcile", body: { amount_due: money(180000) } },
      ]);
    });
  });

  it("offers the institution's facts when the totals differ", async () => {
    await renderApp(path, {
      fetch: api([], {
        [`POST /api/v1/statements/${closedStatementID}/reconcile`]: () =>
          problem(409, "difference_remains"),
      }),
    });
    const dialog = await action("statement.reconcile");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["reconcileStatement.submit"],
      }),
    );
    expect(
      await within(dialog).findByRole("button", {
        name: catalogEn["statement.facts"],
      }),
    ).toBeInTheDocument();
  });

  it("records the institution's facts and says lines may move", async () => {
    const sent: Sent[] = [];
    await renderApp(path, { fetch: api(sent) });
    const dialog = await action("statement.facts");
    expect(
      within(dialog).getByText(catalogEn["facts.moveHint"]),
    ).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: catalogEn["facts.total"] }),
      "185000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "facts",
          body: {
            closing_date: "2026-10-05",
            due_date: "2026-10-25",
            total: money(185000),
          },
        },
      ]);
    });
  });
});

describe("Statement line actions", () => {
  async function lineMenu(name: string) {
    const table = await screen.findByRole("table", {
      name: catalogEn["statement.lines"],
    });
    await userEvent.click(
      await within(table).findByRole("button", {
        name: catalogEn["statement.lineActions"].replace("{name}", name),
      }),
    );
  }

  it("refunds part of a purchase", async () => {
    const sent: Sent[] = [];
    await renderApp(path, {
      fetch: api(sent, {
        "GET /api/v1/transactions/tx1/disputes": () => json(200, { items: [] }),
        "POST /api/v1/transactions/tx1/refunds": async (req) => {
          sent.push({ route: "refund", body: await req.json() });
          return json(201, {});
        },
      }),
    });
    await lineMenu("Mercado");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["refund.action"] }),
    );
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByRole("textbox", {
      name: catalogEn["refund.amount"],
    });
    await userEvent.clear(amount);
    await userEvent.type(amount, "10000");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["refund.submit"] }),
    );
    await waitFor(() => {
      expect(sent.filter((s) => s.route === "refund")).toEqual([
        { route: "refund", body: { date: "2026-10-17", amount: money(10000) } },
      ]);
    });
  });

  it("opens a dispute and marks the line while it is open", async () => {
    const sent: Sent[] = [];
    let open = false;
    await renderApp(path, {
      fetch: api(sent, {
        "GET /api/v1/transactions/tx1/disputes": () =>
          json(200, {
            items: open
              ? [{ id: "d1", transaction_id: "tx1", opened_on: "2026-10-17" }]
              : [],
          }),
        "POST /api/v1/transactions/tx1/disputes": async (req) => {
          sent.push({ route: "dispute", body: await req.json() });
          open = true;
          return json(201, {
            id: "d1",
            transaction_id: "tx1",
            opened_on: "2026-10-17",
          });
        },
      }),
    });
    await lineMenu("Mercado");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["dispute.open"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["dispute.openSubmit"],
      }),
    );
    await waitFor(() => {
      expect(sent.filter((s) => s.route === "dispute")).toEqual([
        { route: "dispute", body: { opened_on: "2026-10-17" } },
      ]);
    });
    expect(
      await screen.findByText(catalogEn["dispute.tag"]),
    ).toBeInTheDocument();
  });

  it("resolves an open dispute as won", async () => {
    const sent: Sent[] = [];
    await renderApp(path, {
      fetch: api(sent, {
        "GET /api/v1/transactions/tx1/disputes": () =>
          json(200, {
            items: [
              { id: "d1", transaction_id: "tx1", opened_on: "2026-10-01" },
            ],
          }),
        "POST /api/v1/disputes/d1/resolve": async (req) => {
          sent.push({ route: "resolve", body: await req.json() });
          return json(200, {});
        },
      }),
    });
    await lineMenu("Mercado");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["dispute.resolve"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: catalogEn["dispute.won"] }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["dispute.resolveSubmit"],
      }),
    );
    await waitFor(() => {
      expect(sent.filter((s) => s.route === "resolve")).toEqual([
        {
          route: "resolve",
          body: { resolved_on: "2026-10-17", outcome: "won" },
        },
      ]);
    });
  });

  it("opens the installment plan of a line and cancels it", async () => {
    const sent: Sent[] = [];
    await renderApp(path, {
      fetch: api(sent, {
        "GET /api/v1/installment-plans/plan1": () =>
          json(200, {
            id: "plan1",
            transaction_id: "tx2",
            account_id: cardID,
            status: "active",
            count: 3,
            installments: [
              {
                number: 1,
                statement: "2026-09",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 2,
                statement: "2026-10",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 3,
                statement: "2026-11",
                amount: money(50000),
                reversed: false,
              },
            ],
          }),
        "POST /api/v1/installment-plans/plan1/cancellation": async (req) => {
          sent.push({ route: "cancel", body: await req.json() });
          return json(201, {});
        },
      }),
    });
    await lineMenu("Geladeira");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["plan.open"] }),
    );
    const drawer = await screen.findByRole("dialog");
    const schedule = await within(drawer).findByRole("table", {
      name: catalogEn["plan.schedule"],
    });
    expect(within(schedule).getAllByRole("row")).toHaveLength(4);
    await userEvent.click(
      within(drawer).getByRole("button", { name: catalogEn["plan.cancel"] }),
    );
    await userEvent.click(
      within(drawer).getByRole("button", {
        name: catalogEn["plan.cancelSubmit"],
      }),
    );
    await waitFor(() => {
      expect(sent.filter((s) => s.route === "cancel")).toEqual([
        { route: "cancel", body: { date: "2026-10-17" } },
      ]);
    });
  });

  it("brings the remaining installments forward only after the confirm", async () => {
    const sent: Sent[] = [];
    await renderApp(path, {
      fetch: api(sent, {
        "GET /api/v1/installment-plans/plan1": () =>
          json(200, {
            id: "plan1",
            transaction_id: "tx2",
            account_id: cardID,
            status: "active",
            count: 4,
            installments: [
              {
                number: 1,
                statement: "2026-09",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 2,
                statement: "2026-10",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 3,
                statement: "2026-11",
                amount: money(50000),
                reversed: false,
              },
              {
                number: 4,
                statement: "2026-12",
                amount: money(50000),
                reversed: false,
              },
            ],
          }),
        "POST /api/v1/installment-plans/plan1/anticipation": async (req) => {
          sent.push({ route: "anticipate", body: await req.json() });
          return json(201, {});
        },
      }),
    });
    await lineMenu("Geladeira");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["plan.open"] }),
    );
    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByRole("table", {
      name: catalogEn["plan.schedule"],
    });
    const choose = within(drawer).getByRole("button", {
      name: catalogEn["plan.anticipate"],
    });
    await userEvent.click(choose);
    // A browser runs a button's default action after the click's listeners: were the chosen
    // button reused as the submit button, the click that chose would also submit.
    expect(
      within(drawer).getByRole("button", {
        name: catalogEn["plan.anticipateSubmit"],
      }),
    ).not.toBe(choose);
    expect(sent.filter((s) => s.route === "anticipate")).toEqual([]);
    await userEvent.click(
      within(drawer).getByRole("button", {
        name: catalogEn["plan.anticipateSubmit"],
      }),
    );
    await waitFor(() => {
      expect(sent.filter((s) => s.route === "anticipate")).toEqual([
        {
          route: "anticipate",
          body: {
            date: "2026-10-17",
            from_installment: 4,
            to_installment: 4,
            target_statement: "2026-11",
            amount: money(50000),
          },
        },
      ]);
    });
  });

  it("offers the plan, not a refund, on an installment line", async () => {
    await renderApp(path, { fetch: api() });
    await lineMenu("Geladeira");
    expect(
      await screen.findByRole("menuitem", { name: catalogEn["plan.open"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: catalogEn["refund.action"] }),
    ).not.toBeInTheDocument();
  });
});
