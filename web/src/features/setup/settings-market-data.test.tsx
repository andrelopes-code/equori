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
  last_run: string | null;
  error: string | null;
}

function feeds(patch: Record<string, Partial<Feed>> = {}): Feed[] {
  return ids.map(([id, kind]) => ({
    id,
    kind,
    enabled: false,
    suggested: ["b3_cotahist", "bcb_ptax", "br_cdi", "br_ipca"].includes(id),
    last: null,
    stale: false,
    last_run: null,
    error: null,
    ...patch[id],
  }));
}

function api(list: Feed[], role = "admin") {
  const puts: { id: string; enabled: boolean }[] = [];
  let refreshes = 0;
  const fetch = fakeApi(
    accountRoutes({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role,
          language: "en",
          region: "BR",
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
            const body = (await req.json()) as { enabled: boolean };
            puts.push({ id, enabled: body.enabled });
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
    expect(b3).toHaveAccessibleDescription(/Overdue: latest data/);
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
});
