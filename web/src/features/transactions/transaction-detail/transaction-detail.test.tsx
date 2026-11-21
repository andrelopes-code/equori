import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { planningApi, rent, rentOctober } from "@/testing/planning-api";
import {
  checkingID,
  foodID,
  leisureID,
  savingsID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const transaction = transactionFixture();

interface Sent {
  path: string;
  body: unknown;
}

function api(
  sent: Sent[] = [],
  detail: () => Response | Promise<Response> = () => json(200, transaction),
) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/transactions": () => json(200, { items: [transaction] }),
    [`GET /api/v1/transactions/${txID}`]: detail,
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, {
        items: [
          {
            version: 2,
            reason: "Wrong amount",
            replaced_at: "2026-10-11T10:00:00Z",
            transaction,
          },
        ],
      }),
    [`GET /api/v1/transactions/${txID}/categorization`]: () =>
      json(200, {
        transaction_id: txID,
        method: "manual",
        decided_at: "2026-10-11T10:00:00Z",
      }),
    [`GET /api/v1/transactions/${txID}/attachments`]: () =>
      json(200, { items: [] }),
    [`POST /api/v1/transactions/${txID}/void`]: async (req) => {
      sent.push({ path: "void", body: await req.json() });
      return json(200, { ...transaction, voided_at: "2026-10-17T12:00:00Z" });
    },
    [`POST /api/v1/transactions/${txID}/categorize`]: async (req) => {
      sent.push({ path: "categorize", body: await req.json() });
      return json(200, { ...transaction, version: 4 });
    },
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("transaction detail", () => {
  // Planning coherence A256: an expense names the goal that paid it.
  it("links an expense to the goal chosen in the detail", async () => {
    const sent: string[] = [];
    const goalID = "d1000000-0000-4000-8000-000000000001";
    const base = api();
    const goals = fakeApi({
      "GET /api/v1/goals": () =>
        json(200, { items: [{ id: goalID, name: "Trip" }] }),
      [`GET /api/v1/goals/${goalID}/expenses`]: () => json(200, { items: [] }),
      [`PUT /api/v1/goals/${goalID}/expenses/${txID}`]: () => {
        sent.push("link");
        return new Response(null, { status: 204 });
      },
    });
    await renderApp(`/transactions/${txID}`, {
      fetch: Object.assign(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(new Request(input, init).url).pathname;
          return path.startsWith("/api/v1/goals")
            ? goals(input, init)
            : base(input, init);
        },
        { calls: [] },
      ),
    });

    const section = await screen.findByRole("region", {
      name: catalogEn["detail.goal"],
    });
    await userEvent.click(
      within(section).getByRole("combobox", {
        name: catalogEn["detail.goal.label"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "Trip" }));

    await waitFor(() => {
      expect(sent).toEqual(["link"]);
    });
  });

  it("lists the occurrences the transaction realized and releases one", async () => {
    const sent: string[] = [];
    const realized = {
      ...rentOctober,
      state: "realized",
      transaction_id: txID,
    };
    const base = api();
    const planning = planningApi({
      "GET /api/v1/occurrences": () => json(200, { items: [realized] }),
      [`POST /api/v1/occurrences/${realized.id}/unrealize`]: () => {
        sent.push("unrealize");
        return json(200, { ...rentOctober, state: "expected" });
      },
    });
    await renderApp(`/transactions/${txID}`, {
      fetch: Object.assign(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(new Request(input, init).url).pathname;
          return path.startsWith("/api/v1/occurrences") ||
            path.startsWith("/api/v1/schedules")
            ? planning(input, init)
            : base(input, init);
        },
        { calls: [] },
      ),
    });
    const section = await screen.findByRole("region", {
      name: catalogEn["detail.occurrences"],
    });
    expect(
      await within(section).findByText(rent.description),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      within(section).getByRole("button", {
        name: catalogEn["occurrence.actions"].replace("{name}", "Rent"),
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["occurrence.unrealize"],
      }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: catalogEn["occurrence.unrealize"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual(["unrealize"]);
    });
  });

  it("asks for the occurrences by transaction, with no date window, in EUR", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const asked: URLSearchParams[] = [];
    const realized = {
      ...rentOctober,
      state: "realized",
      transaction_id: txID,
      expected_amount: { amount: 210000, currency: "EUR" },
    };
    const base = api();
    const planning = planningApi({
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/occurrences": (req) => {
        asked.push(new URL(req.url).searchParams);
        return json(200, { items: [realized] });
      },
    });
    await renderApp(`/transactions/${txID}`, {
      fetch: Object.assign(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(new Request(input, init).url).pathname;
          return path.startsWith("/api/v1/occurrences") ||
            path.startsWith("/api/v1/schedules")
            ? planning(input, init)
            : base(input, init);
        },
        { calls: [] },
      ),
    });
    const section = await screen.findByRole("region", {
      name: catalogEn["detail.occurrences"],
    });
    expect(await within(section).findByText(/€/)).toBeInTheDocument();
    expect(asked.map((q) => [...q.entries()])).toEqual([
      [["transaction_id", txID]],
    ]);
  });

  it("shows the transaction as a page with its postings, facts and history", async () => {
    await renderApp(`/transactions/${txID}`, { fetch: api() });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Padaria" }),
    ).toBeInTheDocument();
    const moved = screen.getByRole("region", {
      name: catalogEn["detail.accounts"],
    });
    const postings = within(moved).getByRole("table", {
      name: catalogEn["postings.caption"],
    });
    expect(within(postings).getByText("Itau")).toBeInTheDocument();
    expect(within(postings).getByText("−R$120.00")).toBeInTheDocument();
    // The category side is the category section's; a +120.00 beside it read as money received.
    expect(within(postings).queryByText("Mercado")).not.toBeInTheDocument();
    expect(
      await screen.findByText(catalogEn["method.manual"]),
    ).toBeInTheDocument();
    expect(await screen.findByText("Version 2 replaced")).toBeInTheDocument();
    expect(screen.getByText("Wrong amount")).toBeInTheDocument();
    expect(
      await screen.findByText(catalogEn["attachments.none"]),
    ).toBeInTheDocument();
  });

  describe("on a phone", () => {
    // Spec 2026-11-21-mobile-transaction-detail, MD1: the header's rule reaches both edges.
    it("spans the detail panel across the page's margin", async () => {
      await renderApp(`/transactions/${txID}`, { width: 390, fetch: api() });
      const heading = await screen.findByRole("heading", {
        level: 1,
        name: "Padaria",
      });

      const panel = heading.closest('[data-ui="detail-panel"]');

      expect(panel?.parentElement).toHaveAttribute("data-part", "breakout");
    });

    // MD2, MD3: the amount stands alone under the header; the subheading keeps the date and accounts.
    it("draws the signed amount as the first block and leaves it out of the subheading", async () => {
      await renderApp(`/transactions/${txID}`, { width: 390, fetch: api() });
      const heading = await screen.findByRole("heading", {
        level: 1,
        name: "Padaria",
      });

      const hero = screen.getByTestId("detail-amount");

      expect(hero).toHaveTextContent("−R$120.00");
      expect(heading.closest("header")).not.toHaveTextContent("R$");
    });

    // MD2: every action of the record in one menu.
    it("holds the record's actions in one menu", async () => {
      const user = userEvent.setup();
      await renderApp(`/transactions/${txID}`, { width: 390, fetch: api() });
      await screen.findByRole("heading", { level: 1, name: "Padaria" });

      expect(
        screen.queryByRole("toolbar", { name: catalogEn["detail.actions"] }),
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: catalogEn["detail.actions"] }),
      );

      for (const name of [
        "detail.correct",
        "detail.transfer",
        "detail.void",
      ] as const) {
        expect(
          await screen.findByRole("menuitem", { name: catalogEn[name] }),
        ).toBeInTheDocument();
      }
      expect(
        screen.queryByRole("menuitem", { name: catalogEn["detail.openPage"] }),
      ).not.toBeInTheDocument();
    });

    // MD5: the accounts involved read as statement rows; a row opens its account.
    it("lists the accounts involved and opens one", async () => {
      const user = userEvent.setup();
      const { router } = await renderApp(`/transactions/${txID}`, {
        width: 390,
        fetch: api(),
      });
      const moved = await screen.findByRole("region", {
        name: catalogEn["detail.accounts"],
      });

      const list = within(moved).getByRole("list", {
        name: catalogEn["postings.caption"],
      });
      await user.click(within(list).getByRole("button", { name: /^Itau/ }));

      expect(within(list).getByText("−R$120.00")).toBeInTheDocument();
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/accounts/${checkingID}`);
      });
    });

    // MD6: a stuck label covered the content scrolling under the top bar.
    it("does not stick the section labels", async () => {
      await renderApp(`/transactions/${txID}`, { width: 390, fetch: api() });
      await screen.findByRole("region", { name: catalogEn["detail.accounts"] });

      const sections = document.querySelectorAll('[data-ui="section"]');

      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section).not.toHaveAttribute("data-sticky");
      }
    });

    // MD7: the placeholder has the receipt's shape.
    it("draws the receipt's shape while the transaction loads", async () => {
      await renderApp(`/transactions/${txID}`, {
        width: 390,
        fetch: api([], () => new Promise<Response>(() => undefined)),
      });

      const shape = await screen.findByTestId("detail-placeholder");

      expect(shape.querySelectorAll('[data-ui="skeleton"]').length).toBe(16);
    });
  });

  it("titles a purchase with an empty description by its instrument", async () => {
    const money = { amount: 10, currency: "BRL" };
    const purchase = transactionFixture({
      description: "",
      payee_id: undefined,
      trade: {
        account_id: savingsID,
        cash_account_id: checkingID,
        side: "buy",
        settlement_date: "2026-10-10",
        quantity: { amount: 10, currency: "AUVP11" },
        unit_price: "10",
        gross: money,
        fees: money,
        taxes: money,
        day_trade_quantity: { amount: 0, currency: "AUVP11" },
        day_trade_cost: { amount: 0, currency: "BRL" },
      },
    });
    await renderApp(`/transactions/${txID}`, {
      fetch: api([], () => json(200, purchase)),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Purchase of AUVP11",
      }),
    ).toBeInTheDocument();
  });

  it("draws no accounts section when every posting is on a category", async () => {
    const brl = (amount: number) => ({ amount, currency: "BRL" });
    const recategorized = transactionFixture({
      postings: [
        {
          id: "p1",
          account_id: leisureID,
          amount: brl(-12000),
          weight: brl(-12000),
          status: "cleared",
        },
        {
          id: "p2",
          account_id: foodID,
          amount: brl(12000),
          weight: brl(12000),
          status: "cleared",
        },
      ],
    });
    await renderApp(`/transactions/${txID}`, {
      width: 390,
      fetch: api([], () => json(200, recategorized)),
    });

    await screen.findByRole("region", { name: catalogEn["detail.category"] });

    expect(
      screen.queryByRole("region", { name: catalogEn["detail.accounts"] }),
    ).not.toBeInTheDocument();
  });

  // Owner review 2026-10-22: on a phone the four labelled actions squeezed into one row and broke
  // inside their words. They stand in a toolbar that folds into its menu what does not fit (LA-03).
  it("holds the record's actions in a toolbar that folds into a menu", async () => {
    await renderApp(`/transactions/${txID}`, { fetch: api() });
    const actions = await screen.findByRole("toolbar", {
      name: catalogEn["detail.actions"],
    });
    for (const name of [
      "detail.correct",
      "detail.transfer",
      "detail.void",
    ] as const) {
      expect(
        within(actions).getByRole("button", { name: catalogEn[name] }),
      ).toBeInTheDocument();
    }
  });

  // IO27: an event is voided and recorded again, never corrected.
  it("offers no correction for a corporate action", async () => {
    const units = (amount: number) => ({ amount, currency: "MXRF11" });
    const action = {
      ...transaction,
      corporate_action: {
        account_id: savingsID,
        kind: "split",
        ratio_from: 1,
        ratio_to: 10,
        held: units(100),
        received: units(1000),
        fraction: "0",
        value: { amount: 0, currency: "BRL" },
      },
    };
    await renderApp(`/transactions/${txID}`, {
      fetch: api([], () => json(200, action)),
    });
    const actions = await screen.findByRole("toolbar", {
      name: catalogEn["detail.actions"],
    });

    expect(
      within(actions).getByRole("button", { name: catalogEn["detail.void"] }),
    ).toBeInTheDocument();
    expect(
      within(actions).queryByRole("button", {
        name: catalogEn["detail.correct"],
      }),
    ).not.toBeInTheDocument();
  });

  it("opens the pane beside the list on a desktop", async () => {
    const { router } = await renderApp("/transactions", {
      width: 1280,
      fetch: api(),
    });
    const cell = await screen.findByText(/^Weekly shop/);
    await userEvent.dblClick(cell);
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ selected: txID });
    });
    expect(
      await screen.findByRole("heading", { level: 2, name: "Padaria" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.close"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
  });

  // Typing into a picker and two amount fields takes several seconds under a loaded runner.
  it(
    "splits the category side into parts that keep the total",
    { timeout: 30_000 },
    async () => {
      const sent: Sent[] = [];
      await renderApp(`/transactions/${txID}`, { fetch: api(sent) });
      await userEvent.click(
        await screen.findByRole("button", {
          name: catalogEn["detail.category.change"],
        }),
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: catalogEn["detail.category.addPart"],
        }),
      );
      const second = screen.getByRole("combobox", {
        name: "Category of part 2",
      });
      await userEvent.type(second, "Lazer");
      await waitFor(() => {
        expect(screen.getAllByRole("option")).toHaveLength(1);
      });
      await userEvent.keyboard("{ArrowDown}{Enter}");
      const first = screen.getByRole("spinbutton", {
        name: "Amount of part 1",
      });
      await userEvent.clear(first);
      await userEvent.type(first, "10000");
      const left = screen.getByRole("spinbutton", { name: "Amount of part 2" });
      await userEvent.clear(left);
      await userEvent.type(left, "2000");
      await userEvent.click(
        screen.getByRole("button", { name: catalogEn["detail.save"] }),
      );
      await waitFor(() => {
        expect(sent[0]).toEqual({
          path: "categorize",
          body: {
            expected_version: 3,
            parts: [
              {
                account_id: foodID,
                amount: { amount: 10000, currency: "BRL" },
              },
              {
                account_id: leisureID,
                amount: { amount: 2000, currency: "BRL" },
              },
            ],
          },
        });
      });
    },
  );

  it("keeps each section's heading under the pane's header while the pane scrolls", async () => {
    await renderApp(`/transactions?selected=${txID}`, {
      width: 1280,
      fetch: api(),
    });
    const heading = await screen.findByRole("heading", {
      level: 3,
      name: new RegExp(`^${catalogEn["detail.accounts"]}`),
    });
    const panel = heading.closest('[data-ui="detail-panel"]');
    expect(panel).not.toBeNull();
    const sections = panel?.querySelectorAll('[data-ui="section"]') ?? [];
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section).toHaveAttribute("data-sticky");
    }
  });

  it("voids with the reason the reader writes", async () => {
    const sent: Sent[] = [];
    await renderApp(`/transactions/${txID}`, { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["detail.void"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: catalogEn["void.reason"] }),
      "Duplicated",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["void.confirm"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ path: "void", body: { reason: "Duplicated" } }]);
    });
  });

  it("says a missing transaction does not exist and keeps the way back", async () => {
    await renderApp(`/transactions/${txID}`, {
      fetch: api([], () => problem(404, "not_found")),
    });
    expect(
      await screen.findByText(catalogEn["detail.notFound"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["nav.transactions"] }),
    ).toHaveAttribute("href", "/transactions");
  });
});
