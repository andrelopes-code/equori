import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const ids = [
  ["b3_cotahist", "price"],
  ["bcb_ptax", "price"],
  ["ecb", "price"],
  ["yahoo_chart", "price"],
  ["br_cdi", "index"],
  ["br_ipca", "index"],
  ["eu_estr", "index"],
  ["ea_hicp", "index"],
  ["us_sofr", "index"],
  ["us_cpi", "index"],
] as const;

interface Feed {
  id: string;
  kind: string;
  enabled: boolean;
  suggested: boolean;
  last: string | null;
  stale: boolean;
  missing: number;
  last_run: string | null;
  activity: string;
  error: string | null;
  official: boolean;
  covers: number;
  history_pending: number;
  symbol_override: boolean;
}

function feeds(patch: Record<string, Partial<Feed>> = {}): Feed[] {
  return ids.map(([id, kind]) => ({
    id,
    kind,
    enabled: false,
    suggested: ["b3_cotahist", "bcb_ptax", "br_cdi", "br_ipca"].includes(id),
    last: null,
    stale: false,
    missing: 0,
    last_run: null,
    activity: "idle",
    error: null,
    official: true,
    covers: 0,
    history_pending: 0,
    symbol_override: false,
    ...patch[id],
  }));
}

interface PutBody {
  enabled: boolean;
  accept_unofficial?: boolean;
}

function api(list: Feed[], role = "admin", region = "BR") {
  const puts: ({ id: string } & PutBody)[] = [];
  let refreshes = 0;
  const fetch = fakeApi(
    accountRoutes({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role,
          language: "en",
          region,
        }),
      "GET /api/v1/market-data/feeds": () => json(200, { items: list }),
      "POST /api/v1/market-data/refresh": () => {
        refreshes++;
        return new Response(null, { status: 202 });
      },
      ...Object.fromEntries(
        ids.map(([id]) => [
          `PUT /api/v1/market-data/feeds/${id}`,
          async (req: Request) => {
            const body = (await req.json()) as PutBody;
            puts.push({ id, ...body });
            const f = list.find((x) => x.id === id);
            if (f !== undefined) f.enabled = body.enabled;
            return json(200, f);
          },
        ]),
      ),
    }),
  );
  return { fetch, puts, refreshes: () => refreshes };
}

function section() {
  return screen.getByRole("region", {
    name: catalogEn["settings.market_data.title"],
  });
}

const open = (fetch: ReturnType<typeof api>["fetch"]) =>
  renderApp("/settings?section=market_data", { fetch });

describe("Market data section (ADR 025 F10)", () => {
  it("shows each feed's latest date and warns about an overdue one", async () => {
    const a = api(
      feeds({
        b3_cotahist: { enabled: true, last: "2026-10-21", stale: true },
        br_cdi: { enabled: true, last: "2026-10-26" },
      }),
    );
    await open(a.fetch);
    const b3 = await within(section()).findByRole("switch", {
      name: catalogEn["marketData.feed.b3_cotahist"],
    });
    expect(b3).toBeChecked();
    expect(b3).toHaveAccessibleDescription(/Overdue/);
    expect(
      within(section()).getByText(catalogEn["marketData.attention"]),
    ).toBeInTheDocument();
  });

  it("enables a feed with its switch", async () => {
    const a = api(feeds({ br_cdi: { enabled: true, last: "2026-10-26" } }));
    await open(a.fetch);
    await userEvent.click(
      await within(section()).findByRole("switch", {
        name: catalogEn["marketData.feed.br_ipca"],
      }),
    );
    await waitFor(() => {
      expect(a.puts).toEqual([{ id: "br_ipca", enabled: true }]);
    });
  });

  it("asks for a confirmation before enabling an unofficial source", async () => {
    const a = api(
      feeds({ yahoo_chart: { official: false, symbol_override: true } }),
    );
    await open(a.fetch);
    const yahoo = () =>
      within(section()).findByRole("switch", {
        name: catalogEn["marketData.feed.yahoo_chart"],
      });
    await userEvent.click(await yahoo());
    expect(
      await screen.findByRole("alertdialog", {
        name: catalogEn["settings.feeds.unofficial.title"],
      }),
    ).toBeInTheDocument();
    expect(a.puts).toEqual([]);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.cancel"] }),
    );
    expect(a.puts).toEqual([]);
    await userEvent.click(await yahoo());
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["settings.feeds.unofficial.confirm"],
      }),
    );
    await waitFor(() => {
      expect(a.puts).toEqual([
        { id: "yahoo_chart", enabled: true, accept_unofficial: true },
      ]);
    });
  });

  it("enables the suggested feeds when none is enabled", async () => {
    const a = api(feeds());
    await open(a.fetch);
    expect(
      await within(section()).findByText(catalogEn["marketData.none"]),
    ).toBeInTheDocument();
    await userEvent.click(
      within(section()).getByRole("button", {
        name: /Enable the sources of Brazil/,
      }),
    );
    await waitFor(() => {
      expect(a.puts.map((p) => p.id)).toEqual([
        "b3_cotahist",
        "bcb_ptax",
        "br_cdi",
        "br_ipca",
      ]);
    });
  });

  it("runs every enabled feed on request", async () => {
    const a = api(feeds({ br_cdi: { enabled: true, last: "2026-10-26" } }));
    await open(a.fetch);
    await userEvent.click(
      await within(section()).findByRole("button", {
        name: catalogEn["marketData.refresh"],
      }),
    );
    expect(
      await within(section()).findByText(catalogEn["marketData.refreshing"]),
    ).toBeInTheDocument();
    expect(a.refreshes()).toBe(1);
  });

  it("lets a member read the feeds without changing them", async () => {
    const a = api(feeds({ br_cdi: { enabled: true } }), "member");
    await open(a.fetch);
    const cdi = await within(section()).findByRole("switch", {
      name: catalogEn["marketData.feed.br_cdi"],
    });
    expect(cdi).toHaveAttribute("aria-readonly", "true");
    expect(
      within(section()).queryByRole("button", {
        name: catalogEn["marketData.refresh"],
      }),
    ).toBeNull();
  });

  // A223: the waiting states of the section.
  it("draws the surface of the pane as placeholders while the feeds load", async () => {
    const a = api(feeds());
    const never = (input: RequestInfo | URL, init?: RequestInit) =>
      new URL(new Request(input, init).url).pathname ===
      "/api/v1/market-data/feeds"
        ? new Promise<Response>(() => undefined)
        : a.fetch(input, init);
    const fetch: typeof a.fetch = Object.assign(never, {
      calls: a.fetch.calls,
    });
    await open(fetch);

    await waitFor(() => {
      expect(
        section().querySelectorAll('[data-ui="skeleton"]').length,
      ).toBeGreaterThan(8);
    });
    expect(within(section()).queryByRole("switch")).toBeNull();
  });

  it("shows a loader beside the refresh action while a history or a run is pending", async () => {
    const a = api(
      feeds({ yahoo_chart: { enabled: true, history_pending: 3 } }),
    );
    await open(a.fetch);

    expect(
      await within(section()).findByRole("progressbar", {
        name: catalogEn["marketData.working"],
      }),
    ).toBeVisible();
  });

  // A267 FA4, FA5: a feed just enabled reads as its first load, and the screen reads it again until
  // the load ends.
  it("follows the first load of a feed to its end", async () => {
    let answers = 0;
    const loading = feeds({
      br_cdi: { enabled: true, activity: "running", history_pending: 1 },
    });
    const done = feeds({ br_cdi: { enabled: true, last: "2026-10-16" } });
    const a = api(loading);
    const turning = (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(new Request(input, init).url).pathname;
      if (path !== "/api/v1/market-data/feeds") return a.fetch(input, init);

      answers += 1;

      return Promise.resolve(
        Response.json({ items: answers === 1 ? loading : done }),
      );
    };
    const fetch: typeof a.fetch = Object.assign(turning, {
      calls: a.fetch.calls,
    });
    await open(fetch);

    expect(
      await within(section()).findByText(catalogEn["marketData.firstLoad"]),
    ).toBeVisible();
    expect(
      within(section()).getByText(catalogEn["marketData.status.loading"]),
    ).toBeVisible();

    expect(
      await within(section()).findByText("10/16/2026", {}, { timeout: 6_000 }),
    ).toBeVisible();
    expect(
      within(section()).queryByText(catalogEn["marketData.firstLoad"]),
    ).toBeNull();
  }, 15_000);

  it("leaves the wait to the row that runs", async () => {
    const a = api(
      feeds({
        br_cdi: { enabled: true, activity: "running", last: "2026-10-16" },
        yahoo_chart: { enabled: true, history_pending: 3 },
      }),
    );
    await open(a.fetch);

    const word = await within(section()).findByText(
      catalogEn["marketData.status.updating"],
    );
    const row = word.closest('[aria-busy="true"]');

    expect(row?.querySelector('[data-ui="progress-indicator"]')).not.toBeNull();
    expect(
      within(section()).queryByRole("progressbar", {
        name: catalogEn["marketData.working"],
      }),
    ).toBeNull();
  });

  it("shows no loader when nothing is pending", async () => {
    const a = api(feeds({ yahoo_chart: { enabled: true } }));
    await open(a.fetch);
    await within(section()).findByRole("switch", {
      name: catalogEn["marketData.feed.yahoo_chart"],
    });

    expect(within(section()).queryByRole("progressbar")).toBeNull();
  });

  it("orders the regions: the book's, the global one, then the others", async () => {
    const a = api(feeds({ b3_cotahist: { enabled: true } }));
    await open(a.fetch);
    await within(section()).findByRole("switch", {
      name: catalogEn["marketData.feed.b3_cotahist"],
    });

    const text = section().textContent;
    const at = (word: string) => text.indexOf(word);

    expect(at("Brazil")).toBeGreaterThan(-1);
    expect(at("Brazil")).toBeLessThan(at("Global"));
    expect(at("Global")).toBeLessThan(at(catalogEn["marketData.others"]));
    expect(
      within(section()).getByText(catalogEn["region.yours"]),
    ).toBeVisible();
  });

  it("keeps the other regions closed until one is opened", async () => {
    const a = api(feeds({ b3_cotahist: { enabled: true } }));
    await open(a.fetch);
    await within(section()).findByRole("switch", {
      name: catalogEn["marketData.feed.b3_cotahist"],
    });
    const eu = () =>
      within(section()).queryByRole("switch", {
        name: catalogEn["marketData.feed.eu_estr"],
      });
    expect(eu()).toBeNull();

    await userEvent.click(
      within(section()).getByText(catalogEn["marketData.others"]),
    );
    await userEvent.click(within(section()).getByText("Euro area"));

    expect(eu()).toBeVisible();
  });

  it("opens the other regions when one of their feeds has a problem", async () => {
    const a = api(
      feeds({ us_sofr: { enabled: true, stale: true, last: "2026-10-01" } }),
    );
    await open(a.fetch);

    expect(
      await within(section()).findByRole("switch", {
        name: catalogEn["marketData.feed.us_sofr"],
      }),
    ).toBeVisible();
  });

  it("marks no region as the book's when the book's region has no feed", async () => {
    const a = api(feeds({ b3_cotahist: { enabled: true } }), "admin", "DE");
    await open(a.fetch);
    await within(section()).findByText("Global");

    expect(within(section()).queryByText(catalogEn["region.yours"])).toBeNull();
  });

  it("tags an unofficial source beside its name", async () => {
    const a = api(
      feeds({
        yahoo_chart: { official: false, enabled: true, last: "2026-11-13" },
      }),
    );
    await open(a.fetch);

    await within(section()).findByRole("switch", {
      name: catalogEn["marketData.feed.yahoo_chart"],
    });
    expect(
      within(section()).getByText(catalogEn["settings.feeds.unofficial.tag"]),
    ).toBeVisible();
  });

  it("states the failure of a feed under its name", async () => {
    const a = api(
      feeds({
        br_cdi: { enabled: true, last: "2026-11-12", error: "HTTP 503" },
      }),
    );
    await open(a.fetch);

    const cdi = await within(section()).findByRole("switch", {
      name: catalogEn["marketData.feed.br_cdi"],
    });

    expect(cdi).toHaveAccessibleDescription(/Last update failed: HTTP 503/);
    expect(cdi).toHaveAccessibleDescription(/Failed/);
  });
});
