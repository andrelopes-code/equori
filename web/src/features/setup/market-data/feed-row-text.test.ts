import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { feedRowText } from "@/features/setup/market-data/feed-row-text";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";

type Feed = components["schemas"]["MarketDataFeed"];

const t = (key: MessageKey, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce(
    (text: string, [name, value]) => text.replace(`{${name}}`, String(value)),
    catalogEn[key],
  );

function feed(patch: Partial<Feed> = {}): Feed {
  return {
    id: "b3_cotahist",
    kind: "price",
    enabled: true,
    suggested: false,
    last: "2026-11-13",
    stale: false,
    last_run: null,
    error: null,
    official: true,
    covers: 28,
    history_pending: 0,
    symbol_override: false,
    current: false,
    current_at: null,
    current_error: null,
    ...patch,
  };
}

describe("feedRowText", () => {
  it("names the source and the kind of a feed", () => {
    expect(feedRowText(feed(), t, "en-US").detail).toBe("B3 · Price");
  });

  it("names only the kind of a feed the catalogs do not name", () => {
    expect(feedRowText(feed({ id: "x" }), t, "en-US").detail).toBe("Price");
  });

  it("writes the coverage of a price feed apart from its detail", () => {
    expect(feedRowText(feed(), t, "en-US").coverage).toBe(
      "Covers 28 instruments",
    );
  });

  it.each([
    [0, "Covers no instrument"],
    [1, "Covers 1 instrument"],
  ])("writes a coverage of %i", (covers, text) => {
    expect(feedRowText(feed({ covers }), t, "en-US").coverage).toBe(text);
  });

  it("has no coverage for an index feed", () => {
    expect(
      feedRowText(feed({ kind: "index", covers: 0 }), t, "en-US").coverage,
    ).toBeNull();
  });

  it("has no issue for a healthy feed", () => {
    expect(feedRowText(feed(), t, "en-US").issue).toBeNull();
  });

  it("states a failure in the danger tone", () => {
    expect(feedRowText(feed({ error: "HTTP 503" }), t, "en-US").issue).toEqual({
      tone: "danger",
      text: "Last update failed: HTTP 503",
    });
  });

  it("states a pending history in the muted tone", () => {
    expect(feedRowText(feed({ history_pending: 3 }), t, "en-US").issue).toEqual(
      { tone: "muted", text: "Loading history: 3 pending" },
    );
  });

  it("puts a failure before a pending history", () => {
    expect(
      feedRowText(feed({ error: "x", history_pending: 3 }), t, "en-US").issue
        ?.tone,
    ).toBe("danger");
  });

  it("ends the detail of a feed that reports current quotes with its mark", () => {
    expect(feedRowText(feed({ current: true }), t, "en-US").detail).toBe(
      "B3 · Price · Current quotes",
    );
  });

  it("leaves the detail of a feed without current quotes unchanged", () => {
    expect(feedRowText(feed({ current: false }), t, "en-US").detail).toBe(
      "B3 · Price",
    );
  });

  it("states the failure of the current quote in the danger tone", () => {
    expect(
      feedRowText(
        feed({ current: true, error: null, current_error: "status 500" }),
        t,
        "en-US",
      ).issue,
    ).toEqual({ tone: "danger", text: "Current quotes failed: status 500" });
  });

  it("puts the failure of the feed before the failure of the current quote", () => {
    expect(
      feedRowText(
        feed({ error: "boom", current_error: "status 500" }),
        t,
        "en-US",
      ).issue?.text,
    ).toBe("Last update failed: boom");
  });

  it("puts the failure of the current quote before a pending history", () => {
    expect(
      feedRowText(
        feed({ current_error: "status 500", history_pending: 2 }),
        t,
        "en-US",
      ).issue?.text,
    ).toBe("Current quotes failed: status 500");
  });
});
