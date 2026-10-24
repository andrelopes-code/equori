import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { planningApi, rent, rentOctober } from "@/testing/planning-api";
import {
  foodID,
  leisureID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const transaction = transactionFixture();

interface Sent {
  path: string;
  body: unknown;
}

function api(sent: Sent[] = [], detail = () => json(200, transaction)) {
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

  it("shows the transaction as a page with its postings, facts and history", async () => {
    await renderApp(`/transactions/${txID}`, { width: 390, fetch: api() });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Padaria" }),
    ).toBeInTheDocument();
    const postings = screen.getByRole("table", {
      name: catalogEn["postings.caption"],
    });
    expect(within(postings).getByText("Itau")).toBeInTheDocument();
    expect(within(postings).getByText("Mercado")).toBeInTheDocument();
    expect(within(postings).getByText("−R$120.00")).toBeInTheDocument();
    expect(
      await screen.findByText(catalogEn["method.manual"]),
    ).toBeInTheDocument();
    expect(await screen.findByText("Version 2 replaced")).toBeInTheDocument();
    expect(screen.getByText("Wrong amount")).toBeInTheDocument();
    expect(
      await screen.findByText(catalogEn["attachments.none"]),
    ).toBeInTheDocument();
  });

  // Owner review 2026-10-22: on a phone the four labelled actions squeezed into one row and broke
  // inside their words. They stand in a toolbar that folds into its menu what does not fit (LA-03).
  it("holds the record's actions in a toolbar that folds into a menu", async () => {
    await renderApp(`/transactions/${txID}`, { width: 390, fetch: api() });
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
      name: new RegExp(`^${catalogEn["detail.postings"]}`),
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
