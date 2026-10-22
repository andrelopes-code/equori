import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  checkingID,
  foodID,
  money,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

const counts = {
  received: 12,
  ignored: 1,
  matched: 6,
  created: 3,
  needs_review: 2,
  discarded: 0,
  updated: 0,
  withdrawn: 0,
};

const batch = {
  id: "b1",
  account_id: checkingID,
  source: "ofx",
  file_name: "setembro.ofx",
  period_from: "2026-09-01",
  period_to: "2026-09-30",
  counts,
  balance: { status: "recorded", date: "2026-09-30", amount: money(500000) },
  started_at: "2026-10-01T12:00:00Z",
};

function record(id: string, description: string, extra = {}) {
  return {
    id,
    batch_id: "b1",
    account_id: checkingID,
    date: "2026-09-10",
    amount: money(-4500),
    description,
    state: "needs_review",
    candidates: ["t1", "t2"],
    review_reason: "ambiguous",
    scored_candidates: [
      {
        transaction_id: "t1",
        score: 9,
        amount: "identical",
        date: "same_day",
        counterparty: "unknown",
      },
      {
        transaction_id: "t2",
        score: 7,
        amount: "identical",
        date: "far",
        counterparty: "similar_description",
      },
    ],
    ...extra,
  };
}

function tx(id: string, description: string) {
  return {
    id,
    date: "2026-09-10",
    description,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      {
        id: `${id}-1`,
        account_id: checkingID,
        amount: money(-4500),
        weight: money(-4500),
        status: "cleared",
      },
      {
        id: `${id}-2`,
        account_id: foodID,
        amount: money(4500),
        weight: money(4500),
        status: "cleared",
      },
    ],
  };
}

function api(
  log: { route: string; body?: unknown; query?: string }[],
  overrides: Record<string, Route> = {},
) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/import-batches/b1": () => json(200, batch),
      "GET /api/v1/import-batches/b1/records": (req) => {
        const state = new URL(req.url).searchParams.get("state") ?? "all";
        log.push({ route: "records", query: state });
        return json(200, {
          items:
            state === "needs_review"
              ? [record("r1", "Padaria"), record("r2", "Mercado")]
              : [
                  record("r9", "Salário", {
                    state: "matched",
                    transaction_id: "t9",
                    candidates: [],
                  }),
                ],
        });
      },
      "GET /api/v1/transactions/t1": () => json(200, tx("t1", "Pão")),
      "GET /api/v1/transactions/t2": () => json(200, tx("t2", "Pão de queijo")),
      "POST /api/v1/external-records/r1/resolve": async (req) => {
        log.push({ route: "resolve r1", body: await req.json() });
        return json(200, record("r1", "Padaria", { state: "matched" }));
      },
      ...overrides,
    }),
  );
}

const path = `/accounts/${checkingID}/imports/b1`;

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

describe("Import batch", () => {
  it("counts what became of the file's lines and of its balance", async () => {
    await renderApp(path, { fetch: api([]) });
    const figures = await screen.findByRole("region", {
      name: catalogEn["batch.figures"],
    });
    expect(within(figures).getByText("12")).toBeInTheDocument();
    expect(within(figures).getByText("6")).toBeInTheDocument();
    expect(within(figures).getByText("3")).toBeInTheDocument();
    expect(
      screen.getByText(
        words("batch.balance.recorded", {
          amount: "R$5,000.00",
          date: "09/30/2026",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("opens on the lines to review and lists them all on request", async () => {
    const log: { route: string; query?: string }[] = [];
    await renderApp(path, { fetch: api(log) });
    await screen.findByRole("list", { name: catalogEn["batch.queue"] });
    expect(log.map((l) => l.query)).toContain("needs_review");
    await userEvent.click(screen.getByRole("radio", { name: /^All/ }));
    expect(await screen.findByText("Salário")).toBeInTheDocument();
    expect(log.map((l) => l.query)).toContain("all");
  });

  it("takes the chosen line's score apart, criterion by criterion", async () => {
    const { router } = await renderApp(path, { fetch: api([]) });
    await userEvent.click(await screen.findByRole("link", { name: /Padaria/ }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ record: "r1" });
    });
    const best = await screen.findByRole("table", {
      name: words("batch.scoreOf", { name: "Pão" }),
    });
    expect(
      within(best).getByText(catalogEn["batch.criterion.amount.identical"]),
    ).toBeInTheDocument();
    expect(within(best).getByText("6 of 6")).toBeInTheDocument();
    expect(
      within(best).getByText(catalogEn["batch.criterion.date.same_day"]),
    ).toBeInTheDocument();
    expect(within(best).getByText("0 of 4")).toBeInTheDocument();
    expect(within(best).getByText("9")).toBeInTheDocument();
  });

  it("matches the line with a candidate and moves to the next line", async () => {
    const log: { route: string; body?: unknown }[] = [];
    const { router } = await renderApp(`${path}?record=r1`, {
      fetch: api(log),
    });
    const best = await screen.findByRole("table", {
      name: words("batch.scoreOf", { name: "Pão" }),
    });
    expect(best).toBeInTheDocument();
    const [first] = screen.getAllByRole("button", {
      name: catalogEn["batch.match"],
    });
    if (first === undefined) throw new Error("no candidate");
    await userEvent.click(first);
    await waitFor(() => {
      expect(log.filter((l) => l.route === "resolve r1")).toEqual([
        {
          route: "resolve r1",
          body: { action: "match", transaction_id: "t1" },
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ record: "r2" });
    });
  });

  it("creates a transaction for the line or discards it", async () => {
    const log: { route: string; body?: unknown }[] = [];
    await renderApp(`${path}?record=r1`, { fetch: api(log) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["batch.create"] }),
    );
    await waitFor(() => {
      expect(log.filter((l) => l.route === "resolve r1")).toEqual([
        { route: "resolve r1", body: { action: "create" } },
      ]);
    });
  });

  it("says when another hand already resolved the line", async () => {
    await renderApp(`${path}?record=r1`, {
      fetch: api([], {
        "POST /api/v1/external-records/r1/resolve": () =>
          problem(409, "record_resolved"),
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["batch.discard"] }),
    );
    expect(
      await screen.findByText(catalogEn["batch.resolvedElsewhere"]),
    ).toBeInTheDocument();
  });

  it("shows only the queue on a phone and the line on its own", async () => {
    await renderApp(path, { fetch: api([]), width: 390 });
    expect(
      await screen.findByRole("list", { name: catalogEn["batch.queue"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /Score of/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("link", { name: /Padaria/ }));
    expect(
      await screen.findByRole("table", {
        name: words("batch.scoreOf", { name: "Pão" }),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: catalogEn["batch.queue"] }),
    ).not.toBeInTheDocument();
  });
});
